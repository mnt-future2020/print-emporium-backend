import mongoose from "mongoose";

const seoSettingsSchema = new mongoose.Schema(
  {
    pageName: {
      type: String,
      required: true,
      trim: true,
      unique: true,
    },
    metaTitle: {
      type: String,
      trim: true,
      maxlength: 60,
    },
    metaDescription: {
      type: String,
      trim: true,
      maxlength: 160,
    },
    keywords: {
      type: String,
      trim: true,
    },
    ogImage: {
      type: String, // Cloudinary public ID
      trim: true,
    },
    lastUpdatedBy: {
      type: String,
      ref: "User",
    },
  },
  {
    timestamps: true,
  }
);

// Index for faster lookups
seoSettingsSchema.index({ pageName: 1 });

export default mongoose.model("SEOSettings", seoSettingsSchema);
