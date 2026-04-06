import mongoose from "mongoose";

const heroSlideSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    subtitle: {
      type: String,
      trim: true,
    },
    image: {
      type: String, // Cloudinary URL
      required: true,
      trim: true,
    },
    iconName: {
      type: String,
      trim: true,
    },
    features: [
      {
        type: String,
        trim: true,
      },
    ],
    ctaText: {
      type: String,
      default: "Get Started",
      trim: true,
    },
    ctaLink: {
      type: String,
      default: "/services",
      trim: true,
    },
    secondaryCtaText: {
      type: String,
      default: "Learn More",
      trim: true,
    },
    secondaryCtaLink: {
      type: String,
      default: "/about",
      trim: true,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    order: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model("HeroSlide", heroSlideSchema);
