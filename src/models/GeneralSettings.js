import mongoose from "mongoose";

const generalSettingsSchema = new mongoose.Schema(
  {
    // Company Information
    companyName: {
      type: String,
      required: true,
      default: "The Print Emporium",
    },
    companyEmail: {
      type: String,
      required: true,
      default: "info@printemporium.com",
    },
    companyPhone: {
      type: String,
      required: true,
      default: "+91 431 2345678",
    },
    whatsappNumber: {
      type: String,
      default: "+91 9876543210",
    },
    companyAddress: {
      type: String,
      required: true,
      default:
        "No. 45, Main Road, Thillai Nagar, Trichy – 620018, Tamil Nadu, India",
    },
    companyDescription: {
      type: String,
      required: true,
      default:
        "Your trusted partner for high-quality printing solutions in Trichy. From business cards to large format prints, we deliver excellence in every project.",
    },
    companyLogo: {
      type: String,
      default: "/images/logo/logo.webp",
    },
    favicon: {
      type: String,
      default: "/favicon.ico",
    },

    // Working Hours
    workingHours: {
      type: String,
      default: "Mon – Sat: 9:00 AM – 8:00 PM\nSun: 10:00 AM – 6:00 PM",
    },

    // Location Settings
    latitude: {
      type: String,
      default: "10.8050456",
    },
    longitude: {
      type: String,
      default: "78.6868581",
    },
    googleMapEmbed: {
      type: String,
      default:
        "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3919.2258756337205!2d78.6868581!3d10.8050456!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x3baaf72c5c0940ad%3A0x2748d41a1133m31!2sThillai%20Nagar%2C%20Tiruchirappalli%2C%20Tamil%20Nadu!5e0!3m2!1sen!2sin!4v1234567890",
    },

    // Social Media Links
    socialMedia: {
      facebook: {
        type: String,
        default: "https://facebook.com/printemporium",
      },
      instagram: {
        type: String,
        default: "https://instagram.com/printemporium",
      },
      twitter: {
        type: String,
        default: "https://twitter.com/printemporium",
      },
      linkedin: {
        type: String,
        default: "https://linkedin.com/company/printemporium",
      },
    },

    // Business Details
    gstNumber: {
      type: String,
      default: "33ABCDE1234F1Z5",
    },
    termsAndConditions: {
      type: String,
      default:
        "All orders are subject to verification. Prices are inclusive of GST. Delivery charges may apply for orders below ₹500.",
    },
    footerNote: {
      type: String,
      default:
        "© 2024 The Print Emporium. All rights reserved. Serving Trichy with quality printing since 2020.",
    },
    trackingWebsiteUrl: {
      type: String,
      default: "https://www.delhivery.com/",
    },

    // Shipping Label Configuration
    shippingLabelSizes: {
      type: [
        {
          name: { type: String, required: true }, // e.g. "4x6", "4x4"
          width: { type: String, required: true }, // e.g. "4in"
          height: { type: String, required: true }, // e.g. "6in"
        },
      ],
      default: [
        { name: "4x6", width: "4in", height: "6in" },
        { name: "4x4", width: "4in", height: "4in" },
        { name: "4x2", width: "4in", height: "2in" },
      ],
    },

    // Email verification fields
    pendingEmailChange: {
      type: String,
      default: null,
    },
    emailVerificationToken: {
      type: String,
      default: null,
    },
    emailVerificationExpiry: {
      type: Date,
      default: null,
    },

    // Metadata
    lastUpdatedBy: {
      type: String,
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
  },
);

// Ensure only one settings document exists
generalSettingsSchema.index({ settingsId: 1 }, { unique: true });

export default mongoose.model("GeneralSettings", generalSettingsSchema);
