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

// indexing is handled by 'unique: true' in pageName field


export default mongoose.model("SEOSettings", seoSettingsSchema);
