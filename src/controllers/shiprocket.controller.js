import Order from "../models/order.model.js";
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
  // 1 sheet of standard paper ≈ 5 g. Use a conservative floor.
  const sheets = (order.items || []).reduce((sum, item) => {
    const pages = Number(item.pageCount || item.pricing?.totalPages || 0);
    const copies = Number(item.configuration?.copies || 1);
    return sum + pages * copies;
  }, 0);
  const grams = Math.max(100, sheets * 5);
  return Number((grams / 1000).toFixed(2));
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
 * GET /api/shiprocket/serviceability?pickup=600001&delivery=625001&weight=0.5
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
    const couriers = await checkServiceability({
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
      couriers,
    });
  } catch (e) {
    return handleErr(res, e, "Failed to check serviceability");
  }
};

/**
 * POST /api/shiprocket/orders/:id/push
 * Admin: push a confirmed order to Shiprocket and persist IDs.
 */
export const pushOrderToShiprocket = async (req, res) => {
  try {
    const { id } = req.params;
    const order = await Order.findById(id);
    if (!order) return res.status(404).json({ success: false, message: "Order not found" });
    if (order.shiprocket?.orderId) {
      return res.status(409).json({
        success: false,
        message: "Order already pushed to Shiprocket",
        shiprocket: order.shiprocket,
      });
    }

    const payload = await buildOrderPayload(order);
    const result = await srCreateOrder(payload);

    order.shiprocket = {
      ...order.shiprocket?.toObject?.(),
      orderId: String(result.order_id),
      shipmentId: String(result.shipment_id),
      lastSyncedAt: new Date(),
    };
    await order.save();

    return res.json({ success: true, shiprocket: order.shiprocket, raw: result });
  } catch (e) {
    return handleErr(res, e, "Failed to push order to Shiprocket");
  }
};

/**
 * POST /api/shiprocket/orders/:id/awb
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
      const couriers = await checkServiceability({
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

    const awb = result?.response?.data?.awb_code || result?.awb_code;
    order.shiprocket = {
      ...order.shiprocket.toObject(),
      awbCode: awb || order.shiprocket.awbCode,
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
 * GET /api/shiprocket/orders/:id/couriers
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
    const couriers = (
      await checkServiceability({
        pickupPincode: srConfig.pickupPincode,
        deliveryPincode,
        weightKg,
        codAmount: order.paymentStatus === "paid" ? 0 : order.pricing?.total || 0,
      })
    )
      .slice()
      .sort((a, b) => (a.rate || 0) - (b.rate || 0));

    return res.json({
      success: true,
      context: { deliveryPincode, weightKg, orderValue: order.pricing?.total || 0 },
      couriers,
    });
  } catch (e) {
    return handleErr(res, e, "Failed to load couriers");
  }
};

/**
 * POST /api/shiprocket/orders/:id/pickup
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
 * GET /api/shiprocket/orders/:id/track
 * Customer + admin can call this to fetch live tracking.
 */
export const trackOrder = async (req, res) => {
  try {
    const { id } = req.params;
    const order = await Order.findById(id);
    if (!order) return res.status(404).json({ success: false, message: "Order not found" });
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
 * GET /api/shiprocket/orders/:id/label
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
 * POST /api/shiprocket/webhook
 * Configure this URL in the Shiprocket dashboard. Token-protected via
 * `?token=...` query string (matched against the webhookToken saved in
 * Settings → Shiprocket).
 */
export const handleWebhook = async (req, res) => {
  try {
    const srConfig = await getResolvedConfig();
    const expected = srConfig?.webhookToken;
    const provided =
      req.query.token ||
      req.headers["x-api-key"] ||
      req.headers["x-webhook-token"];
    if (!expected || provided !== expected) {
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
