import mongoose from "mongoose";

const pricingSettingsSchema = new mongoose.Schema(
  {
    // Fixed regional delivery charges (Additive)
    regionalDeliveryChargeTN: {
      type: Number,
      default: 0,
    },
    regionalDeliveryChargeOutsideTN: {
      type: Number,
      default: 0,
    },

    // Legacy threshold - kept for compatibility
    deliveryThresholds: [
      {
        minAmount: { type: Number, required: true },
        charge: { type: Number, required: true },
      },
    ],

    // Thresholds for packing charges
    // Example: [{ minAmount: 0, charge: 20 }, { minAmount: 1000, charge: 0 }]
    packingThresholds: [
      {
        minAmount: { type: Number, required: true },
        charge: { type: Number, required: true },
      },
    ],

    isDeliveryEnabled: {
      type: Boolean,
      default: true,
    },

    isPackingEnabled: {
      type: Boolean,
      default: true,
    },

    // Metadata
    lastUpdatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    // Singleton pattern - only one settings document
    settingsId: {
      type: String,
      default: "global",
      unique: true,
    },
  },
  {
    timestamps: true,
  }
);

// Ensure only one settings document exists

export default mongoose.model("PricingSettings", pricingSettingsSchema);
