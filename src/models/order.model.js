import mongoose from "mongoose";

const orderItemSchema = new mongoose.Schema({
  serviceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Service",
    required: true,
  },
  serviceName: {
    type: String,
    required: true,
  },
  fileName: {
    type: String,
    required: true,
  },
  fileSize: {
    type: Number,
    required: true,
  },
  pageCount: {
    type: Number,
    required: true,
  },
  filePublicId: {
    type: String,
    default: null,
  },
  pdfPublicId: {
    type: String,
    default: null,
  },
  configuration: {
    printType: { type: String, required: true },
    paperSize: { type: String, required: true },
    paperType: { type: String, default: "standard" },
    gsm: { type: String, default: "standard" },
    printSide: { type: String, default: "single-side" },
    bindingOption: { type: String, default: "none" },
    copies: { type: Number, required: true, min: 1 },
  },
  pricing: {
    basePricePerPage: { type: Number, required: true },
    printTypePrice: { type: Number, default: 0 },
    paperSizePrice: { type: Number, default: 0 },
    paperTypePrice: { type: Number, default: 0 },
    gsmPrice: { type: Number, default: 0 },
    printSidePrice: { type: Number, default: 0 },
    bindingPrice: { type: Number, default: 0 },
    printTypeIsPerCopy: { type: Boolean, default: false },
    paperSizeIsPerCopy: { type: Boolean, default: false },
    paperTypeIsPerCopy: { type: Boolean, default: false },
    gsmIsPerCopy: { type: Boolean, default: false },
    printSideIsPerCopy: { type: Boolean, default: false },
    bindingIsPerCopy: { type: Boolean, default: false },
    pricePerPage: { type: Number, required: true },
    totalPages: { type: Number, required: true },
    copies: { type: Number, required: true },
    subtotal: { type: Number, required: true },
  },
});

const deliveryInfoSchema = new mongoose.Schema({
  fullName: { type: String, required: true },
  phone: { type: String, required: true },
  email: { type: String, required: true },
  address: { type: String, required: true },
  city: { type: String, required: true },
  state: { type: String, required: true },
  pincode: { type: String, required: true },
  deliveryNotes: { type: String, default: "" },
  scheduleDelivery: { type: Boolean, default: false },
  scheduledDate: { type: Date, default: null },
});

const orderSchema = new mongoose.Schema(
  {
    orderNumber: {
      type: String,
      unique: true,
      required: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    items: [orderItemSchema],
    deliveryInfo: deliveryInfoSchema,
    pricing: {
      subtotal: { type: Number, required: true },
      deliveryCharge: { type: Number, required: true },
      packingCharge: { type: Number, default: 0 },
      discount: { type: Number, default: 0 },
      total: { type: Number, required: true },
      couponCode: { type: String, default: null },
    },
    status: {
      type: String,
      enum: [
        "pending",
        "confirmed",
        "processing",
        "printing",
        "shipped",
        "delivered",
        "cancelled",
      ],
      default: "pending",
    },
    paymentStatus: {
      type: String,
      enum: ["pending", "paid", "failed", "refunded"],
      default: "pending",
    },
    paymentMethod: {
      type: String,
      enum: [
        "cod",
        "online",
        "upi",
        "razorpay",
        "netbanking",
        "card",
        "wallet",
        "bank_transfer",
        "emi",
        "cardless_emi",
        "paylater",
      ],
      default: "online",
    },
    paymentId: {
      type: String,
      default: null,
    },
    trackingNumber: {
      type: String,
      default: null,
    },
    estimatedDelivery: {
      type: Date,
      default: null,
    },
    invoiceEmailSent: {
      type: Boolean,
      default: false,
    },
    invoiceEmailSentAt: {
      type: Date,
      default: null,
    },
    notes: {
      type: String,
      default: "",
    },
  },
  {
    timestamps: true,
  }
);

// Generate order number before saving
// Generate order number before saving - REMOVED (Handled in controller now)

// Index for faster queries
orderSchema.index({ userId: 1, createdAt: -1 });
orderSchema.index({ orderNumber: 1 });
orderSchema.index({ status: 1 });

const Order = mongoose.model("Order", orderSchema);

export default Order;
