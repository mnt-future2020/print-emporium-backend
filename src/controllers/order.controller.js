import Order from "../models/order.model.js";
import {
  uploadToCloudinary,
  uploadRawToCloudinary,
  getUrlFromPublicId,
  getRawUrlFromPublicId,
} from "../utils/cloudinary-helper.js";
import { convertFileToPdf } from "./fileConversion.controller.js";
import { generateInvoiceHTML } from "../services/invoice.service.js";
import { generatePDFFromHTML } from "../utils/pdf-generator.js";
import { sendOrderStatusUpdateEmail } from "../services/email.service.js";

/**
 * Upload order file to Cloudinary and convert to PDF
 */
export const uploadOrderFile = async (req, res) => {
  try {
    const { fileData, fileName, pdfData } = req.body;

    if (!fileData || !fileName) {
      return res.status(400).json({
        success: false,
        error: "File data and name are required",
      });
    }

    const customPublicId = fileName.split(".")[0];
    const fileExtension = fileName.split(".").pop().toLowerCase();

    // 1. Upload original file as RAW to preserve original format
    console.log(`Uploading original ${fileName} to Cloudinary (raw)...`);
    const originalUpload = await uploadRawToCloudinary(
      fileData,
      "printemporium/orders/originals",
      `${customPublicId}.${fileExtension}`, // Include extension in public_id
    );

    let pdfPublicId = null;

    // 2. Handle PDF version
    if (fileExtension === "pdf") {
      // For original PDFs, also upload as image resource type for proper display
      console.log(
        "File is already PDF, uploading as image resource type for display...",
      );
      const pdfUpload = await uploadToCloudinary(
        fileData,
        "printemporium/orders/pdfs",
        `${customPublicId}_pdf`,
        { resource_type: "image", format: "pdf" },
      );
      pdfPublicId = pdfUpload.public_id;
    } else if (pdfData) {
      // Use the PDF data provided by frontend (converted on client)
      console.log(`Uploading provided PDF data for ${fileName}...`);
      const pdfUpload = await uploadToCloudinary(
        pdfData,
        "printemporium/orders/pdfs",
        `${customPublicId}_pdf`,
        { resource_type: "image", format: "pdf" },
      );
      pdfPublicId = pdfUpload.public_id;
    } else {
      // Optional: If no pdfData provided, we could convert it here on server
      console.log(
        `No PDF data provided, attempting server-side conversion for ${fileName}...`,
      );
      try {
        // Extract base64 content and clean it
        let base64Content = fileData.includes(",")
          ? fileData.split(",")[1]
          : fileData;
        base64Content = base64Content.replace(/\s/g, ""); // Remove all whitespace

        // Validate base64 content
        if (!base64Content || base64Content.length === 0) {
          throw new Error("Empty base64 content");
        }

        // Create buffer from base64
        const buffer = Buffer.from(base64Content, "base64");

        // Validate buffer
        if (buffer.length === 0) {
          throw new Error("Buffer is empty after base64 decode");
        }

        console.log(
          `Buffer created: ${buffer.length} bytes for ${fileExtension} file`,
        );

        // Convert to PDF
        const pdfBuffer = await convertFileToPdf(buffer, fileExtension);
        const pdfBase64 = `data:application/pdf;base64,${pdfBuffer.toString("base64")}`;

        const pdfUpload = await uploadToCloudinary(
          pdfBase64,
          "printemporium/orders/pdfs",
          `${customPublicId}_pdf`,
          { resource_type: "image", format: "pdf" },
        );
        pdfPublicId = pdfUpload.public_id;
      } catch (convError) {
        console.error("Server-side conversion failed:", convError);
        console.warn("Falling back to uploading original file as PDF...");

        // Last resort: upload original file and let Cloudinary handle it
        try {
          const pdfUpload = await uploadToCloudinary(
            fileData,
            "printemporium/orders/pdfs",
            `${customPublicId}_pdf`,
            { resource_type: "image", format: "pdf" },
          );
          pdfPublicId = pdfUpload.public_id;
        } catch (uploadErr) {
          console.error("Fallback upload also failed:", uploadErr);
          // Set pdfPublicId to null - order can still be created without PDF
          pdfPublicId = null;
        }
      }
    }

    // Return both public_ids
    res.json({
      success: true,
      filePublicId: originalUpload.public_id,
      pdfPublicId: pdfPublicId,
    });
  } catch (error) {
    console.error("File upload error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to upload file",
      details: error.message,
    });
  }
};

import Coupon from "../models/coupon.model.js";

/**
 * Create a new order
 */
export const createOrder = async (req, res) => {
  try {
    const { items, deliveryInfo, pricing, couponCode } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: "Authentication required" });
    }

    if (!items || items.length === 0) {
      return res
        .status(400)
        .json({ error: "Order must contain at least one item" });
    }

    if (!deliveryInfo) {
      return res
        .status(400)
        .json({ error: "Delivery information is required" });
    }

    // Validate coupon if provided
    let appliedDiscount = 0;
    let couponDoc = null;
    
    if (couponCode) {
      couponDoc = await Coupon.findOne({ code: couponCode.toUpperCase(), isActive: true });
      if (couponDoc) {
        // Simple server-side validation
        const now = new Date();
        const isNotExpired = !couponDoc.expiryDate || now <= couponDoc.expiryDate;
        const isUnderLimit = !couponDoc.usageLimit || couponDoc.usedCount < couponDoc.usageLimit;
        const isAboveMinAmount = pricing.subtotal >= couponDoc.minOrderAmount;

        if (isNotExpired && isUnderLimit && isAboveMinAmount) {
          if (couponDoc.type === "percentage") {
            appliedDiscount = (pricing.subtotal * couponDoc.value) / 100;
            if (couponDoc.maxDiscountAmount && appliedDiscount > couponDoc.maxDiscountAmount) {
              appliedDiscount = couponDoc.maxDiscountAmount;
            }
          } else {
            appliedDiscount = couponDoc.value;
          }
          
          // Increment used count
          couponDoc.usedCount += 1;
          await couponDoc.save();
        } else {
          console.warn(`Attempted invalid coupon use: ${couponCode}`);
          // We could return error here, but for now we'll just ignore the invalid coupon
          // to keep the order flow smooth, or we can be strict.
          // Let's be strict for security.
          let reason = "invalid";
          if (!isNotExpired) reason = "expired";
          if (!isUnderLimit) reason = "limit reached";
          if (!isAboveMinAmount) reason = "minimum amount not met";
          
          return res.status(400).json({ error: `Coupon is ${reason}` });
        }
      } else {
        return res.status(400).json({ error: "Invalid coupon code" });
      }
    }

    // Recalculate total on server for safety
    const serverCalculatedTotal = Math.max(0, pricing.subtotal + pricing.deliveryCharge + pricing.packingCharge - appliedDiscount);
    
    // Validate required delivery fields
    const requiredFields = [
      "fullName",
      "phone",
      "email",
      "address",
      "city",
      "state",
      "pincode",
    ];
    for (const field of requiredFields) {
      if (!deliveryInfo[field]) {
        return res.status(400).json({ error: `${field} is required` });
      }
    }

    const orderNumber = await generateOrderNumber();

    // Create the order
    const order = new Order({
      userId,
      orderNumber,
      items: items.map((item) => ({
        serviceId: item.serviceId,
        serviceName: item.serviceName,
        fileName: item.file.name,
        fileSize: item.file.size,
        pageCount: item.file.pageCount,
        filePublicId: item.file.filePublicId || null, // Original file public_id
        pdfPublicId: item.file.pdfPublicId || null, // PDF file public_id
        configuration: item.configuration,
        pricing: item.pricing,
      })),
      deliveryInfo: {
        ...deliveryInfo,
        scheduledDate:
          deliveryInfo.scheduleDelivery && deliveryInfo.scheduledDate
            ? new Date(deliveryInfo.scheduledDate)
            : null,
      },
      pricing: {
        ...pricing,
        discount: appliedDiscount,
        total: serverCalculatedTotal,
        couponCode: couponCode || null,
      },
      status: "pending",
      paymentStatus: "pending",
      estimatedDelivery:
        deliveryInfo.scheduleDelivery && deliveryInfo.scheduledDate
          ? new Date(deliveryInfo.scheduledDate)
          : null,
    });

    await order.save();

    res.status(201).json({
      success: true,
      order: {
        id: order._id,
        orderNumber: order.orderNumber,
        status: order.status,
        paymentStatus: order.paymentStatus,
        total: order.pricing.total,
        estimatedDelivery: order.estimatedDelivery,
        createdAt: order.createdAt,
      },
    });
  } catch (error) {
    console.error("Create order error:", error);
    res.status(500).json({
      error: "Failed to create order",
      details: error.message,
    });
  }
};

/**
 * Get all orders for the current user
 */
export const getUserOrders = async (req, res) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const { status, page = 1, limit = 10 } = req.query;

    const query = { userId };
    if (status) {
      query.status = status;
    }

    const orders = await Order.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .lean();

    // Convert public_ids to URLs
    const ordersWithUrls = orders.map((order) => ({
      ...order,
      items: order.items.map((item) => ({
        ...item,
        fileUrl: item.filePublicId
          ? getRawUrlFromPublicId(item.filePublicId)
          : null,
        pdfUrl: item.pdfPublicId ? getUrlFromPublicId(item.pdfPublicId) : null,
      })),
    }));

    const total = await Order.countDocuments(query);

    res.json({
      success: true,
      orders: ordersWithUrls,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Get user orders error:", error);
    res.status(500).json({
      error: "Failed to fetch orders",
      details: error.message,
    });
  }
};

/**
 * Get a single order by ID
 */
export const getOrderById = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;
    const userRole = req.user?.role;

    if (!userId) {
      return res.status(401).json({ error: "Authentication required" });
    }

    // For regular users, only allow access to their own orders
    let order;
    if (userRole === "admin" || userRole === "employee") {
      // Admins and employees can view any order
      order = await Order.findOne({ _id: id }).lean();
    } else {
      // Regular users can only view their own orders
      order = await Order.findOne({ _id: id, userId }).lean();
    }

    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }

    // Convert public_ids to URLs
    const orderWithUrls = {
      ...order,
      items: order.items.map((item) => ({
        ...item,
        fileUrl: item.filePublicId
          ? getRawUrlFromPublicId(item.filePublicId)
          : null,
        pdfUrl: item.pdfPublicId ? getUrlFromPublicId(item.pdfPublicId) : null,
      })),
    };

    res.json({
      success: true,
      order: orderWithUrls,
    });
  } catch (error) {
    console.error("Get order error:", error);
    res.status(500).json({
      error: "Failed to fetch order",
      details: error.message,
    });
  }
};

/**
 * Cancel an order (user can cancel pending orders)
 */
export const cancelOrder = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const order = await Order.findOne({ _id: id, userId });

    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }

    // Only allow cancellation of pending or confirmed orders
    if (!["pending", "confirmed"].includes(order.status)) {
      return res.status(400).json({
        error: "Cannot cancel order",
        message: "Order is already being processed and cannot be cancelled",
      });
    }

    order.status = "cancelled";
    await order.save();

    res.json({
      success: true,
      message: "Order cancelled successfully",
      order: {
        id: order._id,
        orderNumber: order.orderNumber,
        status: order.status,
      },
    });
  } catch (error) {
    console.error("Cancel order error:", error);
    res.status(500).json({
      error: "Failed to cancel order",
      details: error.message,
    });
  }
};

/**
 * Reorder a previously placed order
 */
export const reorderOrder = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: "Authentication required" });
    }

    // Find the original order
    const oldOrder = await Order.findOne({ _id: id, userId });

    if (!oldOrder) {
      return res.status(404).json({ error: "Original order not found" });
    }

    // Generate a new order number
    const orderNumber = await generateOrderNumber();

    // Create a new order by copying items and delivery info
    const newOrder = new Order({
      userId,
      orderNumber,
      items: oldOrder.items.map((item) => ({
        serviceId: item.serviceId,
        serviceName: item.serviceName,
        fileName: item.fileName,
        fileSize: item.fileSize,
        pageCount: item.pageCount,
        filePublicId: item.filePublicId,
        pdfPublicId: item.pdfPublicId,
        configuration: item.configuration,
        pricing: item.pricing,
      })),
      deliveryInfo: oldOrder.deliveryInfo,
      pricing: oldOrder.pricing,
      status: "pending",
      paymentStatus: "pending",
      notes: `Reordered from #${oldOrder.orderNumber}`,
    });

    await newOrder.save();

    res.status(201).json({
      success: true,
      message: "Order reordered successfully",
      order: {
        id: newOrder._id,
        orderNumber: newOrder.orderNumber,
        status: newOrder.status,
        paymentStatus: newOrder.paymentStatus,
        total: newOrder.pricing.total,
        deliveryInfo: newOrder.deliveryInfo,
      },
    });
  } catch (error) {
    console.error("Reorder error:", error);
    res.status(500).json({
      error: "Failed to reorder",
      details: error.message,
    });
  }
};

/**
 * Helper to generate unique order numbers
 */
async function generateOrderNumber() {
  const date = new Date();
  const year = date.getFullYear().toString().slice(-2);
  const month = (date.getMonth() + 1).toString().padStart(2, "0");
  const day = date.getDate().toString().padStart(2, "0");

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date();
  endOfDay.setHours(23, 59, 59, 999);

  const count = await Order.countDocuments({
    createdAt: { $gte: startOfDay, $lte: endOfDay },
  });

  const sequence = (count + 1).toString().padStart(4, "0");
  return `PE${year}${month}${day}${sequence}`;
}

// ============ ADMIN ENDPOINTS ============

/**
 * Get all orders (admin only)
 */
export const getAllOrders = async (req, res) => {
  try {
    const { status, paymentStatus, page = 1, limit = 20, search } = req.query;

    const query = {};
    if (status) query.status = status;
    if (paymentStatus) query.paymentStatus = paymentStatus;
    if (search) {
      query.$or = [
        { orderNumber: { $regex: search, $options: "i" } },
        { "deliveryInfo.fullName": { $regex: search, $options: "i" } },
        { "deliveryInfo.phone": { $regex: search, $options: "i" } },
      ];
    }

    const orders = await Order.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .populate("userId", "name email")
      .lean();

    // Convert public_ids to URLs
    const ordersWithUrls = orders.map((order) => ({
      ...order,
      items: order.items.map((item) => ({
        ...item,
        fileUrl: item.filePublicId
          ? getRawUrlFromPublicId(item.filePublicId)
          : null,
        pdfUrl: item.pdfPublicId ? getUrlFromPublicId(item.pdfPublicId) : null,
      })),
    }));

    const total = await Order.countDocuments(query);

    res.json({
      success: true,
      orders: ordersWithUrls,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Get all orders error:", error);
    res.status(500).json({
      error: "Failed to fetch orders",
      details: error.message,
    });
  }
};

/**
 * Update order status (admin only)
 */
export const updateOrderStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, trackingNumber, notes } = req.body;

    const order = await Order.findById(id);

    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }

    const oldStatus = order.status;

    if (status) order.status = status;
    if (trackingNumber) order.trackingNumber = trackingNumber;
    if (notes) order.notes = notes;

    await order.save();

    // Send email notification if status updated
    if (status && status !== oldStatus) {
      try {
        await sendOrderStatusUpdateEmail(order);
      } catch (emailError) {
        console.error("Failed to send status update email:", emailError);
      }
    }

    res.json({
      success: true,
      order: {
        id: order._id,
        orderNumber: order.orderNumber,
        status: order.status,
        trackingNumber: order.trackingNumber,
      },
    });
  } catch (error) {
    console.error("Update order status error:", error);
    res.status(500).json({
      error: "Failed to update order status",
      details: error.message,
    });
  }
};

/**
 * Get order statistics (admin only)
 */
export const getOrderStats = async (req, res) => {
  try {
    const { startDate, endDate, period = "month" } = req.query;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const thisMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const thisWeek = new Date(today);
    thisWeek.setDate(today.getDate() - today.getDay());
    const thisYear = new Date(today.getFullYear(), 0, 1);

    // Date filter based on period or custom range
    let dateFilter = {};
    let comparisonDateFilter = {};

    if (startDate && endDate) {
      // Custom date range
      dateFilter = {
        createdAt: {
          $gte: new Date(startDate),
          $lte: new Date(endDate),
        },
      };
    } else {
      // Period-based filtering
      switch (period) {
        case "today":
          dateFilter = { createdAt: { $gte: today } };
          comparisonDateFilter = {
            createdAt: {
              $gte: new Date(today.getTime() - 24 * 60 * 60 * 1000),
              $lt: today,
            },
          };
          break;
        case "week":
          dateFilter = { createdAt: { $gte: thisWeek } };
          comparisonDateFilter = {
            createdAt: {
              $gte: new Date(thisWeek.getTime() - 7 * 24 * 60 * 60 * 1000),
              $lt: thisWeek,
            },
          };
          break;
        case "year":
          dateFilter = { createdAt: { $gte: thisYear } };
          comparisonDateFilter = {
            createdAt: {
              $gte: new Date(thisYear.getFullYear() - 1, 0, 1),
              $lt: thisYear,
            },
          };
          break;
        case "month":
        default:
          dateFilter = { createdAt: { $gte: thisMonth } };
          comparisonDateFilter = {
            createdAt: {
              $gte: lastMonth,
              $lt: thisMonth,
            },
          };
          break;
      }
    }

    const [
      totalOrders,
      todayOrders,
      weekOrders,
      monthOrders,
      comparisonOrders,
      pendingOrders,
      confirmedOrders,
      processingOrders,
      printingOrders,
      shippedOrders,
      deliveredOrders,
      cancelledOrders,
      paidOrders,
      unpaidOrders,
      revenueStats,
      comparisonRevenue,
      todayRevenue,
      weekRevenue,
      monthlyRevenueChart,
      dailyOrdersChart,
      ordersByService,
      ordersByPaymentMethod,
      topCustomers,
      recentOrders,
    ] = await Promise.all([
      // Order counts with period filter
      Order.countDocuments(dateFilter),
      Order.countDocuments({ createdAt: { $gte: today } }),
      Order.countDocuments({ createdAt: { $gte: thisWeek } }),
      Order.countDocuments({ createdAt: { $gte: thisMonth } }),
      Order.countDocuments(comparisonDateFilter),

      // Status counts with period filter
      Order.countDocuments({ status: "pending", ...dateFilter }),
      Order.countDocuments({ status: "confirmed", ...dateFilter }),
      Order.countDocuments({ status: "processing", ...dateFilter }),
      Order.countDocuments({ status: "printing", ...dateFilter }),
      Order.countDocuments({ status: "shipped", ...dateFilter }),
      Order.countDocuments({ status: "delivered", ...dateFilter }),
      Order.countDocuments({ status: "cancelled", ...dateFilter }),

      // Payment status counts with period filter
      Order.countDocuments({ paymentStatus: "paid", ...dateFilter }),
      Order.countDocuments({ paymentStatus: "pending", ...dateFilter }),

      // Revenue stats with period filter
      Order.aggregate([
        { $match: { paymentStatus: "paid", ...dateFilter } },
        {
          $group: {
            _id: null,
            total: { $sum: "$pricing.total" },
            count: { $sum: 1 },
          },
        },
      ]),
      Order.aggregate([
        { $match: { paymentStatus: "paid", ...comparisonDateFilter } },
        { $group: { _id: null, total: { $sum: "$pricing.total" } } },
      ]),
      Order.aggregate([
        { $match: { paymentStatus: "paid", createdAt: { $gte: today } } },
        { $group: { _id: null, total: { $sum: "$pricing.total" } } },
      ]),
      Order.aggregate([
        { $match: { paymentStatus: "paid", createdAt: { $gte: thisWeek } } },
        { $group: { _id: null, total: { $sum: "$pricing.total" } } },
      ]),

      // Monthly revenue chart (last 12 months)
      Order.aggregate([
        {
          $match: {
            paymentStatus: "paid",
            createdAt: {
              $gte: new Date(today.getFullYear() - 1, today.getMonth(), 1),
            },
          },
        },
        {
          $group: {
            _id: {
              year: { $year: "$createdAt" },
              month: { $month: "$createdAt" },
            },
            revenue: { $sum: "$pricing.total" },
            orders: { $sum: 1 },
          },
        },
        { $sort: { "_id.year": 1, "_id.month": 1 } },
      ]),

      // Daily orders chart (filtered by period)
      Order.aggregate([
        { $match: dateFilter },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
            orders: { $sum: 1 },
            revenue: {
              $sum: {
                $cond: [
                  { $eq: ["$paymentStatus", "paid"] },
                  "$pricing.total",
                  0,
                ],
              },
            },
          },
        },
        { $sort: { _id: 1 } },
      ]),

      // Orders by service (filtered by period)
      Order.aggregate([
        { $match: dateFilter },
        { $unwind: "$items" },
        {
          $group: {
            _id: "$items.serviceName",
            count: { $sum: 1 },
            revenue: { $sum: "$items.pricing.subtotal" },
          },
        },
        { $sort: { count: -1 } },
        { $limit: 10 },
      ]),

      // Orders by payment method (filtered by period)
      Order.aggregate([
        { $match: { paymentStatus: "paid", ...dateFilter } },
        {
          $group: {
            _id: "$paymentMethod",
            count: { $sum: 1 },
            revenue: { $sum: "$pricing.total" },
          },
        },
        { $sort: { count: -1 } },
      ]),

      // Top customers (filtered by period)
      Order.aggregate([
        { $match: { paymentStatus: "paid", ...dateFilter } },
        {
          $group: {
            _id: "$userId",
            totalOrders: { $sum: 1 },
            totalSpent: { $sum: "$pricing.total" },
            customerName: { $first: "$deliveryInfo.fullName" },
            customerEmail: { $first: "$deliveryInfo.email" },
          },
        },
        { $sort: { totalSpent: -1 } },
        { $limit: 5 },
      ]),

      // Recent orders (filtered by period)
      Order.find(dateFilter)
        .sort({ createdAt: -1 })
        .limit(5)
        .select(
          "orderNumber status paymentStatus pricing.total createdAt deliveryInfo.fullName",
        )
        .lean(),
    ]);

    // Calculate growth percentages
    const currentRevenue = revenueStats[0]?.total || 0;
    const prevRevenue = comparisonRevenue[0]?.total || 0;
    const revenueGrowth =
      prevRevenue > 0
        ? (((currentRevenue - prevRevenue) / prevRevenue) * 100).toFixed(1)
        : 0;

    const orderGrowth =
      comparisonOrders > 0
        ? (((totalOrders - comparisonOrders) / comparisonOrders) * 100).toFixed(
            1,
          )
        : 0;

    res.json({
      success: true,
      stats: {
        // Summary cards (filtered by period)
        totalOrders,
        todayOrders,
        weekOrders,
        monthOrders,
        totalRevenue: currentRevenue,
        todayRevenue: todayRevenue[0]?.total || 0,
        weekRevenue: weekRevenue[0]?.total || 0,
        averageOrderValue:
          paidOrders > 0 ? (currentRevenue / paidOrders).toFixed(2) : 0,

        // Growth metrics
        revenueGrowth: parseFloat(revenueGrowth),
        orderGrowth: parseFloat(orderGrowth),

        // Status breakdown
        statusBreakdown: {
          pending: pendingOrders,
          confirmed: confirmedOrders,
          processing: processingOrders,
          printing: printingOrders,
          shipped: shippedOrders,
          delivered: deliveredOrders,
          cancelled: cancelledOrders,
        },

        // Payment status
        paymentBreakdown: {
          paid: paidOrders,
          pending: unpaidOrders,
        },

        // Charts data
        charts: {
          monthlyRevenue: monthlyRevenueChart.map((item) => ({
            month: `${item._id.year}-${String(item._id.month).padStart(2, "0")}`,
            revenue: item.revenue,
            orders: item.orders,
          })),
          dailyOrders: dailyOrdersChart.map((item) => ({
            date: item._id,
            orders: item.orders,
            revenue: item.revenue,
          })),
          ordersByService: ordersByService.map((item) => ({
            service: item._id,
            count: item.count,
            revenue: item.revenue,
          })),
          ordersByPaymentMethod: ordersByPaymentMethod.map((item) => ({
            method: item._id || "Unknown",
            count: item.count,
            revenue: item.revenue,
          })),
        },

        // Top data
        topCustomers,
        recentOrders,
      },
    });
  } catch (error) {
    console.error("Get order stats error:", error);
    res.status(500).json({
      error: "Failed to fetch order statistics",
      details: error.message,
    });
  }
};

/**
 * Generate and download invoice PDF for a paid order
 */
export const downloadInvoice = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;
    const isAdminOrEmployee =
      req.user?.role === "admin" || req.user?.role === "employee";

    if (!userId) {
      return res.status(401).json({ error: "Authentication required" });
    }

    // Find order - admin/employee can access any order, users only their own
    const query = isAdminOrEmployee ? { _id: id } : { _id: id, userId };
    const order = await Order.findOne(query);

    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }

    // Only generate invoice for paid orders
    if (order.paymentStatus !== "paid") {
      return res.status(400).json({
        error: "Invoice can only be generated for paid orders",
        paymentStatus: order.paymentStatus,
      });
    }

    // Generate invoice HTML
    const invoiceHTML = await generateInvoiceHTML(order);

    // Convert HTML to PDF
    const invoicePDF = await generatePDFFromHTML(invoiceHTML);

    // Set response headers for PDF download
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="Invoice-${order.orderNumber}.pdf"`,
    );
    res.setHeader("Content-Length", invoicePDF.length);

    // Send PDF buffer
    res.send(invoicePDF);
  } catch (error) {
    console.error("Download invoice error:", error);
    res.status(500).json({
      error: "Failed to generate invoice",
      details: error.message,
    });
  }
};
