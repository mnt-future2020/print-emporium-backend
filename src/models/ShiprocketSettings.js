import mongoose from "mongoose";

const shiprocketSettingsSchema = new mongoose.Schema(
  {
    enabled: {
      type: Boolean,
      default: true,
    },
    email: {
      type: String,
      required: true,
      trim: true,
    },
    // Encrypted via utils/encryption.js
    password: {
      type: String,
      required: true,
    },
    pickupLocation: {
      type: String,
      default: "Primary",
      trim: true,
    },
    // Required by the serviceability API to look up couriers/rates for an order.
    pickupPincode: {
      type: String,
      default: "",
      trim: true,
    },
    // Encrypted — used to authenticate the inbound webhook
    webhookToken: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

export default mongoose.model("ShiprocketSettings", shiprocketSettingsSchema);
