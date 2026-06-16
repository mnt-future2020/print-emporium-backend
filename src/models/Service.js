import mongoose from "mongoose";

const serviceSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    slug: {
      type: String,
      trim: true,
      lowercase: true,
      index: true,
      unique: true,
      sparse: true,
    },
    description: {
      type: String,
      trim: true,
      default: "",
    },
    image: {
      type: String, // Cloudinary Public ID
      trim: true,
    },
    basePricePerPage: {
      type: Number,
      default: 0,
    },
    basePriceRanges: [
      {
        min: { type: Number },
        max: { type: Number },
        price: { type: Number },
      },
    ],
    weightSampleSheets: {
      type: Number,
      default: 100,
      min: 1,
    },
    weightSampleGrams: {
      type: Number,
      default: 500,
      min: 1,
    },
    customQuotation: {
      type: Boolean,
      default: false,
    },
    printTypes: [
      {
        value: String,
        pricePerPage: { type: Number },
        pricePerCopy: { type: Number },
      },
    ],
    paperSizes: [
      {
        value: String,
        pricePerPage: { type: Number },
        pricePerCopy: { type: Number },
      },
    ],
    paperTypes: [
      {
        value: String,
        pricePerPage: { type: Number },
        pricePerCopy: { type: Number },
      },
    ],
    gsmOptions: [
      {
        value: String,
        pricePerPage: { type: Number },
        pricePerCopy: { type: Number },
      },
    ],
    printSides: [
      {
        value: String,
        pricePerPage: { type: Number },
        pricePerCopy: { type: Number },
      },
    ],
    bindingOptions: [
      {
        value: String,
        pricePerPage: { type: Number },
        pricePerCopy: { type: Number },
        minPages: { type: Number },
        fixedPrice: { type: Number },
        priceRanges: [
          {
            min: { type: Number },
            max: { type: Number },
            price: { type: Number },
          },
        ],
      },
    ],
    status: {
      type: String,
      enum: ["active", "inactive", "coming-soon"],
      default: "active",
      index: true,
    },
    lastUpdatedBy: {
      type: String,
      ref: "User",
    },
  },
  {
    timestamps: true,
  },
);

// Auto-generate a URL-safe slug from the service name when missing or when name changes.
const slugify = (str) =>
  String(str || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "") // strip punctuation
    .replace(/\s+/g, "-") // spaces → hyphens
    .replace(/-+/g, "-") // collapse repeats
    .replace(/^-|-$/g, ""); // trim hyphens

serviceSchema.pre("save", function (next) {
  if (this.isModified("name") || !this.slug) {
    this.slug = slugify(this.name) || undefined;
  }
  next();
});

// Validation: Ensure only one pricing field is set for each option in arrays
serviceSchema.pre("save", function (next) {
  const optionArrays = [
    "printTypes",
    "paperSizes",
    "paperTypes",
    "gsmOptions",
    "printSides",
    "bindingOptions",
  ];

  for (const arrayName of optionArrays) {
    const options = this[arrayName];
    if (options && Array.isArray(options)) {
      for (const option of options) {
        // Allow negative prices ONLY for printSides
        const isPrintSide = arrayName === "printSides";
        const hasPricePerPage = option.pricePerPage !== undefined && option.pricePerPage !== 0;
        const hasPricePerCopy = option.pricePerCopy !== undefined && option.pricePerCopy !== 0;

        if (hasPricePerPage && hasPricePerCopy) {
          const error = new Error(
            `Cannot set both pricePerPage and pricePerCopy for ${arrayName}. Please choose only one pricing type per option.`,
          );
          return next(error);
        }

        // For other categories, still prevent negative values if they were previously blocked
        // (The previous code used > 0, which implicitly blocked negatives)
        if (!isPrintSide) {
          if (option.pricePerPage < 0 || option.pricePerCopy < 0) {
            const error = new Error(`Negative prices are only allowed for Print Side options.`);
            return next(error);
          }
        }

        // Clean up undefined/zero fields
        if (!hasPricePerPage) {
          option.pricePerPage = undefined;
        }
        if (!hasPricePerCopy) {
          option.pricePerCopy = undefined;
        }
      }
    }
  }

  if (typeof next === "function") {
    next();
  }
});

export default mongoose.model("Service", serviceSchema);
