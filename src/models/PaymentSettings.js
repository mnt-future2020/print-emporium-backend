import mongoose from "mongoose";

const paymentSettingsSchema = new mongoose.Schema(
  {
    razorpayKeyId: {
      type: String,
      required: true,
    },
    razorpayKeySecret: {
      type: String, // Encrypted
      required: true,
    },
    razorpayWebhookSecret: {
      type: String, // Encrypted
    },
    updatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model("PaymentSettings", paymentSettingsSchema);
