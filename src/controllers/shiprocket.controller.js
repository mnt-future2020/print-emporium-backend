import crypto from "crypto";
import Order from "../models/order.model.js";
import Service from "../models/Service.js";
import GeneralSettings from "../models/GeneralSettings.js";
import ShiprocketSettings from "../models/ShiprocketSettings.js";
import { encryptPassword, decryptPassword } from "../utils/encryption.js";
import {
  checkServiceability,
  createOrder as srCreateOrder,
  assignAwb as srAssignAwb,
  requestPickup as srRequestPickup,
  trackByAwb,
  generateLabel,
  getResolvedConfig,
  invalidateConfigCache,
  verifyCredentials,
  getPickupLocations as srGetPickupLocations,
  generateInvoice as srGenerateInvoice,
  cancelShiprocketOrder as srCancelOrder,
  generateManifest as srGenerateManifest,
  getManifest as srGetManifest,
  ShiprocketError,
} from "../services/shiprocket.service.js";

// ──────────────────────────────────────────────────────────────
//  Helpers
// ──────────────────────────────────────────────────────────────

const handleErr = (res, error, fallback = "Shiprocket request failed") => {
  if (error instanceof ShiprocketError) {
    return res.status(error.status || 502).json({
      success: false,
      message: error.message || fallback,
      details: error.body,
    });
  }
  return res.status(500).json({ success: false, message: fallback });
};

const totalWeightKg = (order) => {
  const grams = (order.items || []).reduce((sum, item) => {
    const pages = Number(item.pageCount || item.pricing?.totalPages || 0);
    const copies = Number(item.configuration?.copies || 1);
    const sampleSheets = Number(item.weightSampleSheets) || 100;
    const sampleGrams = Number(item.weightSampleGrams) || 500;
    const gramsPerSheet = sampleGrams / sampleSheets;
    return sum + pages * copies * gramsPerSheet;
  }, 0);
  return Number((Math.max(100, grams) / 1000).toFixed(2));
};

const buildOrderPayload = async (order) => {
  const settings = await GeneralSettings.findOne({ settingsId: "global" });
  const companyName = settings?.companyName || "Print Emporium";
  const customerName = order.deliveryInfo?.fullName || "Customer";
  const [billingFirst, ...billingRest] = customerName.split(" ");

  const subtotal = order.pricing?.subtotal || 0;
  const totalWeight = totalWeightKg(order);
  const lengthCm = 25;
  const breadthCm = 18;
  const heightCm = Math.max(1, Math.ceil(totalWeight * 4)); // rough proxy

  const srConfig = await getResolvedConfig();
  const pickupLocation = srConfig?.pickupLocation || "Primary";

  return {
    order_id: order.orderNumber,
    order_date: new Date(order.createdAt).toISOString().slice(0, 16).replace("T", " "),
    pickup_location: pickupLocation,
    channel_id: "",
    comment: companyName,
    billing_customer_name: billingFirst || customerName,
    billing_last_name: billingRest.join(" ") || "-",
    billing_address: [order.deliveryInfo?.doorNumber, order.deliveryInfo?.address]
      .filter(Boolean)
      .join(", "),
    billing_address_2: order.deliveryInfo?.landmark || "",
    billing_city: order.deliveryInfo?.city || "",
    billing_pincode: order.deliveryInfo?.pincode || "",
    billing_state: order.deliveryInfo?.state || "",
    billing_country: "India",
    billing_email: order.deliveryInfo?.email || "",
    billing_phone: order.deliveryInfo?.phone || "",
    shipping_is_billing: true,
    order_items: (order.items || []).map((item) => ({
      name: `${item.serviceName || "Print"} — ${item.fileName || ""}`.slice(0, 100),
      sku: String(item._id || item.serviceId || "SKU"),
      units: Number(item.configuration?.copies || 1),
      selling_price: Number(item.pricing?.subtotal || 0),
      discount: 0,
      tax: 0,
      hsn: 4901,
    })),
    payment_method: order.paymentStatus === "paid" ? "Prepaid" : "COD",
    sub_total: subtotal,
    length: lengthCm,
    breadth: breadthCm,
    height: heightCm,
    weight: totalWeight,
  };
};

// ──────────────────────────────────────────────────────────────
//  HTTP handlers
// ──────────────────────────────────────────────────────────────

/**
 * GET /api/shipping/serviceability?pickup=600001&delivery=625001&weight=0.5
 * Public endpoint customers can call from the checkout page.
 */
export const getServiceability = async (req, res) => {
  try {
    const { pickup, delivery, weight = "0.5", cod = "0" } = req.query;
    if (!pickup || !delivery) {
      return res
        .status(400)
        .json({ success: false, message: "pickup and delivery pincodes are required" });
    }
    const { couriers, recommendedId } = await checkServiceability({
      pickupPincode: pickup,
      deliveryPincode: delivery,
      weightKg: Number(weight) || 0.5,
      codAmount: Number(cod) || 0,
    });
    const cheapest = couriers
      .slice()
      .sort((a, b) => (a.rate || 0) - (b.rate || 0))[0];
    return res.json({
      success: true,
      serviceable: couriers.length > 0,
      cheapestRate: cheapest?.rate || null,
      cheapestCourier: cheapest?.courier_name || null,
      etd: cheapest?.etd || null,
      recommendedId,
      couriers,
    });
  } catch (e) {
    return handleErr(res, e, "Failed to check serviceability");
  }
};

/**
 * POST /api/shipping/checkout-rate
 * Public — called during checkout to get the cheapest shipping rate.
 * Body: { deliveryPincode, items: [{ serviceId, pageCount, copies }] }
 */
export const getCheckoutRate = async (req, res) => {
  const fallback = { success: true, serviceable: false, deliveryCharge: 0, courierName: null, etd: null, fallback: true };
  try {
    const { deliveryPincode, items, orderValue } = req.body || {};
    if (!deliveryPincode || !/^\d{6}$/.test(String(deliveryPincode)) || !Array.isArray(items) || items.length === 0) {
      return res.json(fallback);
    }

    const srConfig = await getResolvedConfig();
    if (!srConfig?.pickupPincode) return res.json(fallback);

    // Look up weight info for each service
    const serviceIds = [...new Set(items.map((i) => i.serviceId).filter(Boolean))];
    const services = await Service.find({ _id: { $in: serviceIds } })
      .select("_id weightSampleSheets weightSampleGrams")
      .lean();
    const weightMap = Object.fromEntries(
      services.map((s) => [String(s._id), { sheets: s.weightSampleSheets || 100, grams: s.weightSampleGrams || 500 }]),
    );

    // Calculate total weight
    const grams = items.reduce((sum, item) => {
      const w = weightMap[item.serviceId] || { sheets: 100, grams: 500 };
      const pages = Number(item.pageCount) || 0;
      const copies = Number(item.copies) || 1;
      return sum + (pages * copies * w.grams) / w.sheets;
    }, 0);
    const weightKg = Number((Math.max(100, grams) / 1000).toFixed(2));

    const { couriers } = await checkServiceability({
      pickupPincode: srConfig.pickupPincode,
      deliveryPincode: String(deliveryPincode),
      weightKg,
      declaredValue: Math.round(Number(orderValue) || 0),
    });

    if (!couriers || couriers.length === 0) {
      return res.json({ ...fallback, serviceable: false });
    }

    // Sum all charge fields for the real total (same logic as service layer)
    const withTotal = couriers.map((c) => {
      let total = 0;
      for (const [key, val] of Object.entries(c)) {
        if ((key.endsWith("_charge") || key.endsWith("_charges")) && key !== "rto_charges" && key !== "total_charges") {
          const n = Number(val);
          if (n > 0) total += n;
        }
      }
      return { ...c, _total: total || c.rate };
    });

    const byCost = [...withTotal].sort((a, b) => a._total - b._total);
    const bySpeed = [...withTotal].sort((a, b) => {
      const daysA = Number(a.estimated_delivery_days) || 99;
      const daysB = Number(b.estimated_delivery_days) || 99;
      return daysA - daysB || a._total - b._total;
    });

    const recommended = byCost[0];
    const fastest = bySpeed[0];

    const fmt = (c) => ({
      rate: c._total,
      courierName: c.courier_name || null,
      etd: c.etd || null,
      estimatedDays: c.estimated_delivery_days || null,
      courierId: c.courier_company_id,
    });

    return res.json({
      success: true,
      serviceable: true,
      fallback: false,
      recommended: fmt(recommended),
      fastest: fastest.courier_company_id !== recommended.courier_company_id ? fmt(fastest) : null,
    });
  } catch (e) {
    return res.json(fallback);
  }
};

/**
 * POST /api/shipping/orders/:id/push
 * Admin: push a confirmed order to Shiprocket and persist IDs.
 */
export const pushOrderToShiprocket = async (req, res) => {
  try {
    const { id } = req.params;
    const order = await Order.findById(id);
    if (!order) return res.status(404).json({ success: false, message: "Order not found" });
    if (order.shiprocket?.orderId && order.shiprocket?.orderId !== "undefined") {
      return res.status(409).json({
        success: false,
        message: "Order already pushed to Shiprocket",
        shiprocket: order.shiprocket,
      });
    }

    const payload = await buildOrderPayload(order);
    const result = await srCreateOrder(payload);

    const orderId = result?.order_id || result?.data?.order_id || result?.response?.data?.order_id;
    const shipmentId = result?.shipment_id || result?.data?.shipment_id || result?.response?.data?.shipment_id;

    if (!orderId || !shipmentId) {
      return res.status(400).json({ success: false, message: "Failed to parse order or shipment ID from Shiprocket response", raw: result });
    }

    const shiprocketData = order.shiprocket?.toObject ? order.shiprocket.toObject() : (order.shiprocket || {});

    order.shiprocket = {
      ...shiprocketData,
      orderId: String(orderId),
      shipmentId: String(shipmentId),
      lastSyncedAt: new Date(),
    };
    await order.save();

    return res.json({ success: true, shiprocket: order.shiprocket, raw: result });
  } catch (e) {
    return handleErr(res, e, "Failed to push order to Shiprocket");
  }
};

/**
 * POST /api/shipping/orders/:id/awb
 * Body: { courierId? } — if omitted, picks the cheapest serviceable courier.
 */
export const assignOrderAwb = async (req, res) => {
  try {
    const { id } = req.params;
    const order = await Order.findById(id);
    if (!order) return res.status(404).json({ success: false, message: "Order not found" });
    if (!order.shiprocket?.shipmentId) {
      return res
        .status(400)
        .json({ success: false, message: "Push the order to Shiprocket first" });
    }

    let courierId = req.body?.courierId;
    let courierName = null;

    if (!courierId) {
      const srConfig = await getResolvedConfig();
      if (!srConfig?.pickupPincode) {
        return res.status(400).json({
          success: false,
          message:
            "Set the pickup pincode in Settings → Shiprocket to look up couriers.",
        });
      }
      const { couriers } = await checkServiceability({
        pickupPincode: srConfig.pickupPincode,
        deliveryPincode: order.deliveryInfo?.pincode,
        weightKg: totalWeightKg(order),
      });
      const cheapest = couriers.sort((a, b) => (a.rate || 0) - (b.rate || 0))[0];
      if (!cheapest) {
        return res
          .status(400)
          .json({ success: false, message: "No serviceable courier for this pincode" });
      }
      courierId = cheapest.courier_company_id;
      courierName = cheapest.courier_name;
    }

    const result = await srAssignAwb({
      shipmentId: order.shiprocket.shipmentId,
      courierId,
    });

    // Check if AWB assignment actually succeeded
    if (result?.awb_assign_status === 0 || (!result?.response?.data?.awb_code && !result?.awb_code)) {
      const errMsg =
        result?.response?.data?.awb_assign_error ||
        result?.message ||
        "AWB assignment failed";
      return res.status(400).json({ success: false, message: errMsg });
    }

    const awb = result?.response?.data?.awb_code || result?.awb_code;
    order.shiprocket = {
      ...order.shiprocket.toObject(),
      awbCode: awb,
      courierId,
      courierName:
        result?.response?.data?.courier_name || courierName || order.shiprocket.courierName,
      lastSyncedAt: new Date(),
    };
    if (awb) order.trackingNumber = awb;
    await order.save();

    return res.json({ success: true, shiprocket: order.shiprocket, raw: result });
  } catch (e) {
    return handleErr(res, e, "Failed to assign AWB");
  }
};

/**
 * GET /api/shipping/orders/:id/couriers
 * Returns the serviceable couriers for an order so the admin can pick one
 * (sorted cheapest-first) instead of always auto-assigning the cheapest.
 */
export const getOrderCouriers = async (req, res) => {
  try {
    const { id } = req.params;
    const order = await Order.findById(id);
    if (!order)
      return res.status(404).json({ success: false, message: "Order not found" });

    const srConfig = await getResolvedConfig();
    if (!srConfig?.pickupPincode) {
      return res.status(400).json({
        success: false,
        message:
          "Set the pickup pincode in Settings → Shiprocket to look up couriers.",
      });
    }
    const deliveryPincode = order.deliveryInfo?.pincode;
    if (!deliveryPincode) {
      return res
        .status(400)
        .json({ success: false, message: "Order has no delivery pincode" });
    }

    const weightKg = totalWeightKg(order);
    const result = await checkServiceability({
      pickupPincode: srConfig.pickupPincode,
      deliveryPincode,
      weightKg,
      codAmount: order.paymentStatus === "paid" ? 0 : order.pricing?.total || 0,
      declaredValue: Math.round(order.pricing?.total || 0),
    });
    const couriers = result.couriers
      .slice()
      .sort((a, b) => (a.rate || 0) - (b.rate || 0));

    return res.json({
      success: true,
      context: { deliveryPincode, weightKg, orderValue: order.pricing?.total || 0 },
      recommendedId: result.recommendedId,
      couriers,
    });
  } catch (e) {
    return handleErr(res, e, "Failed to load couriers");
  }
};

/**
 * POST /api/shipping/orders/:id/pickup
 */
export const schedulePickup = async (req, res) => {
  try {
    const { id } = req.params;
    const order = await Order.findById(id);
    if (!order || !order.shiprocket?.shipmentId) {
      return res
        .status(400)
        .json({ success: false, message: "Order has no Shiprocket shipment" });
    }
    const result = await srRequestPickup({ shipmentIds: [order.shiprocket.shipmentId] });
    return res.json({ success: true, raw: result });
  } catch (e) {
    return handleErr(res, e, "Failed to schedule pickup");
  }
};

/**
 * GET /api/shipping/orders/:id/track
 * Customer + admin can call this to fetch live tracking.
 */
export const trackOrder = async (req, res) => {
  try {
    const { id } = req.params;
    const order = await Order.findById(id);
    if (!order) return res.status(404).json({ success: false, message: "Order not found" });

    // Authorization: customers can only track their own orders
    const isAdminOrEmployee = req.user?.role === "admin" || req.user?.role === "employee";
    if (!isAdminOrEmployee && String(order.userId) !== String(req.user?.id)) {
      return res.status(403).json({ success: false, message: "Not authorized to track this order" });
    }

    const awb = order.shiprocket?.awbCode || order.trackingNumber;
    if (!awb) {
      return res
        .status(404)
        .json({ success: false, message: "No tracking number yet" });
    }
    const data = await trackByAwb(awb);
    const track = data?.tracking_data || {};
    const status = track?.shipment_status || track?.track_status;

    if (status && status !== order.shiprocket?.lastStatus) {
      order.shiprocket.lastStatus = status;
      order.shiprocket.lastStatusAt = new Date();
      order.shiprocket.lastSyncedAt = new Date();
      await order.save();
    }
    return res.json({ success: true, tracking: track });
  } catch (e) {
    return handleErr(res, e, "Failed to fetch tracking");
  }
};

/**
 * GET /api/shipping/orders/:id/label
 */
export const getLabel = async (req, res) => {
  try {
    const { id } = req.params;
    const order = await Order.findById(id);
    if (!order?.shiprocket?.shipmentId) {
      return res
        .status(400)
        .json({ success: false, message: "Order has no Shiprocket shipment" });
    }
    const result = await generateLabel({ shipmentIds: [order.shiprocket.shipmentId] });
    const url = result?.label_url;
    if (url) {
      order.shiprocket.labelUrl = url;
      await order.save();
    }
    return res.json({ success: true, labelUrl: url, raw: result });
  } catch (e) {
    return handleErr(res, e, "Failed to generate label");
  }
};

/**
 * GET /api/shipping/orders/:id/invoice
 */
export const getShiprocketInvoice = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order?.shiprocket?.orderId) {
      return res.status(400).json({ success: false, message: "Order has no Shiprocket order" });
    }
    const result = await srGenerateInvoice({ orderIds: [Number(order.shiprocket.orderId)] });
    const url = result?.invoice_url || result?.is_invoice_created;
    return res.json({ success: true, invoiceUrl: url || null, raw: result });
  } catch (e) {
    return handleErr(res, e, "Failed to generate Shiprocket invoice");
  }
};

/**
 * POST /api/shipping/orders/:id/cancel
 */
export const cancelOrder = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order?.shiprocket?.orderId) {
      return res.status(400).json({ success: false, message: "Order has no Shiprocket order" });
    }
    const result = await srCancelOrder({ orderIds: [Number(order.shiprocket.orderId)] });

    order.shiprocket.lastStatus = "Cancelled";
    order.shiprocket.lastStatusAt = new Date();
    order.shiprocket.lastSyncedAt = new Date();
    await order.save();

    return res.json({ success: true, raw: result });
  } catch (e) {
    return handleErr(res, e, "Failed to cancel Shiprocket order");
  }
};

/**
 * POST /api/shipping/orders/:id/manifest
 */
export const getManifest = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order?.shiprocket?.shipmentId) {
      return res.status(400).json({ success: false, message: "Order has no shipment" });
    }

    await srGenerateManifest({ shipmentIds: [Number(order.shiprocket.shipmentId)] });
    const result = await srGetManifest({ orderId: Number(order.shiprocket.orderId) });
    const url = result?.manifest_url;

    if (url) {
      order.shiprocket.manifestUrl = url;
      await order.save();
    }
    return res.json({ success: true, manifestUrl: url || null, raw: result });
  } catch (e) {
    return handleErr(res, e, "Failed to generate manifest");
  }
};

/**
 * POST /api/shipping/webhook
 * Configure this URL in the Shiprocket dashboard. Token-protected via
 * `?token=...` query string (matched against the webhookToken saved in
 * Settings → Shiprocket).
 */
export const handleWebhook = async (req, res) => {
  try {
    const srConfig = await getResolvedConfig();
    const expected = srConfig?.webhookToken;
    const provided =
      req.headers["x-api-key"] ||
      req.headers["x-webhook-token"] ||
      req.query.token;
    if (!expected || !provided) {
      return res.status(401).json({ success: false, message: "Invalid webhook token" });
    }
    const a = Buffer.from(String(provided));
    const b = Buffer.from(String(expected));
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      return res.status(401).json({ success: false, message: "Invalid webhook token" });
    }

    const body = req.body || {};
    // Shiprocket payloads vary; common fields:
    const awb = body.awb || body.awb_code;
    const orderId = body.order_id; // our orderNumber
    const status = body.current_status || body.shipment_status;

    const query = awb
      ? { $or: [{ "shiprocket.awbCode": awb }, { trackingNumber: awb }] }
      : orderId
        ? { orderNumber: String(orderId) }
        : null;

    if (!query) return res.json({ success: true, ignored: true });

    const order = await Order.findOne(query);
    if (!order) return res.json({ success: true, ignored: "order not found" });

    order.shiprocket = order.shiprocket || {};
    order.shiprocket.lastStatus = status || order.shiprocket.lastStatus;
    order.shiprocket.lastStatusAt = new Date();
    order.shiprocket.lastSyncedAt = new Date();

    // Bridge to our own order.status when meaningful.
    const s = (status || "").toLowerCase();
    // "undelivered"/"rto"/"return" contain "delivered" but are NOT a successful
    // delivery — check them before the broad "delivered" match.
    if (s.includes("undelivered") || s.includes("rto") || s.includes("return")) {
      order.status = "shipped";
    } else if (s.includes("delivered")) order.status = "delivered";
    else if (
      s.includes("shipped") ||
      s.includes("in transit") ||
      s.includes("out for delivery") ||
      s.includes("picked") ||
      s.includes("pickup")
    ) {
      order.status = "shipped";
    } else if (s.includes("cancelled")) order.status = "cancelled";

    if (awb && !order.trackingNumber) order.trackingNumber = awb;
    await order.save();
    return res.json({ success: true });
  } catch (e) {
    return handleErr(res, e, "Webhook handler failed");
  }
};

// ──────────────────────────────────────────────────────────────
//  Settings (admin dashboard)
// ──────────────────────────────────────────────────────────────

const MASK = "********";

/**
 * GET /api/settings/shiprocket/pickup-locations
 * Fetches pickup addresses from the Shiprocket account for the settings dropdown.
 */
export const getPickupLocations = async (req, res) => {
  try {
    const locations = await srGetPickupLocations();
    return res.json({ success: true, locations });
  } catch (e) {
    return handleErr(res, e, "Failed to fetch pickup locations");
  }
};

/**
 * GET /api/settings/shiprocket
 * Returns the saved settings with secrets masked.
 */
export const getShiprocketSettings = async (req, res) => {
  try {
    const config = await ShiprocketSettings.findOne();
    if (!config) {
      return res.json({
        success: true,
        shiprocketConfig: {
          enabled: true,
          email: "",
          password: "",
          pickupLocation: "Primary",
          pickupPincode: "",
          webhookToken: "",
        },
      });
    }
    return res.json({
      success: true,
      shiprocketConfig: {
        enabled: config.enabled,
        email: config.email || "",
        password: config.password ? MASK : "",
        pickupLocation: config.pickupLocation || "Primary",
        pickupPincode: config.pickupPincode || "",
        webhookToken: config.webhookToken ? MASK : "",
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * PUT /api/settings/shiprocket
 * Validates the credentials against Shiprocket before saving.
 */
export const updateShiprocketSettings = async (req, res) => {
  try {
    const {
      enabled,
      email,
      password,
      pickupLocation,
      pickupPincode,
      webhookToken,
    } = req.body || {};

    if (!email) {
      return res
        .status(400)
        .json({ success: false, message: "Shiprocket email is required" });
    }

    const existing = await ShiprocketSettings.findOne();

    // Resolve password to use: incoming raw, or kept existing if masked.
    let passwordToSave;
    let passwordForVerification;
    if (!password) {
      return res
        .status(400)
        .json({ success: false, message: "Shiprocket password is required" });
    }
    if (password === MASK) {
      if (!existing?.password) {
        return res
          .status(400)
          .json({ success: false, message: "Shiprocket password is required" });
      }
      passwordToSave = existing.password;
      passwordForVerification = decryptPassword(existing.password);
    } else {
      passwordToSave = encryptPassword(password);
      passwordForVerification = password;
    }

    // Fail-fast: verify with Shiprocket before persisting.
    try {
      await verifyCredentials({ email, password: passwordForVerification });
    } catch (err) {
      return res.status(400).json({
        success: false,
        message:
          err?.message ||
          "Invalid Shiprocket credentials. Connection failed.",
      });
    }

    // Webhook token: same masked-passthrough logic.
    let webhookTokenToSave = null;
    if (webhookToken && webhookToken !== MASK) {
      webhookTokenToSave = encryptPassword(webhookToken);
    } else if (webhookToken === MASK) {
      webhookTokenToSave = existing?.webhookToken || null;
    }

    const updated = await ShiprocketSettings.findOneAndUpdate(
      {},
      {
        enabled: enabled !== undefined ? !!enabled : true,
        email,
        password: passwordToSave,
        pickupLocation: pickupLocation || "Primary",
        pickupPincode: pickupPincode || "",
        webhookToken: webhookTokenToSave,
      },
      { upsert: true, new: true },
    );

    // New creds → force the next request to login again.
    invalidateConfigCache();

    return res.json({
      success: true,
      shiprocketConfig: {
        enabled: updated.enabled,
        email: updated.email,
        password: updated.password ? MASK : "",
        pickupLocation: updated.pickupLocation,
        pickupPincode: updated.pickupPincode || "",
        webhookToken: updated.webhookToken ? MASK : "",
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
