import mongoose from "mongoose";

const serviceSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    image: {
      type: String, // Cloudinary Public ID
      trim: true,
    },
    basePricePerPage: {
      type: Number,
      default: 0,
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
      enum: ["active", "inactive"],
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
        if (option.pricePerPage > 0 && option.pricePerCopy > 0) {
          const error = new Error(
            `Cannot set both pricePerPage and pricePerCopy for ${arrayName}. Please choose only one pricing type per option.`,
          );
          return next(error);
        }

        // Remove the field that is 0 or undefined to keep only the selected pricing type
        if (!option.pricePerPage || option.pricePerPage === 0) {
          option.pricePerPage = undefined;
        }
        if (!option.pricePerCopy || option.pricePerCopy === 0) {
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
