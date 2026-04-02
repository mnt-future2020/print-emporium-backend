import mongoose from "mongoose";

const serviceOptionSchema = new mongoose.Schema(
  {
    category: {
      type: String,
      required: true,
      enum: [
        "printType",
        "paperSize",
        "paperType",
        "gsm",
        "printSide",
        "bindingOption",
      ],
      index: true,
    },
    label: {
      type: String,
      required: true,
      trim: true,
    },
    value: {
      type: String,
      required: true,
      trim: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    pricePerPage: {
      type: Number,
    },
    pricePerCopy: {
      type: Number,
    },
    minPages: {
      type: Number,
    },
    fixedPrice: {
      type: Number,
    },
    priceRanges: [
      {
        min: { type: Number },
        max: { type: Number },
        price: { type: Number },
      },
    ],
  },
  {
    timestamps: true,
  },
);

// Validation: Ensure only one pricing field is set (either pricePerPage OR pricePerCopy, not both)
// For bindingOption, we allow fixedPrice and ignore pricePerPage/pricePerCopy if present?
// Or better, standard validation for print options vs binding options.
serviceOptionSchema.pre("save", function (next) {
  // If bindingOption, we expect fixedPrice.
  // If bindingOption, we allow fixedPrice or priceRanges
  if (this.category === "bindingOption") {
    const hasFixed = this.fixedPrice !== undefined && this.fixedPrice >= 0;
    const hasRanges = this.priceRanges && this.priceRanges.length > 0;

    if (hasFixed || hasRanges) {
      // Valid for binding
      // We might want to clear others to avoid confusion
      this.pricePerPage = undefined;
      this.pricePerCopy = undefined;
    }
    // If neither, effectively it's free or invalid? Mongoose doesn't enforce required here except category/label/value
  } else {
    // Standard validation for other types
    if (this.pricePerPage > 0 && this.pricePerCopy > 0) {
      const error = new Error(
        "Cannot set both pricePerPage and pricePerCopy. Please choose only one pricing type.",
      );
      return next(error);
    }

    // Remove the field that is 0 or undefined to keep only the selected pricing type
    if (!this.pricePerPage || this.pricePerPage === 0) {
      this.pricePerPage = undefined;
    }
    if (!this.pricePerCopy || this.pricePerCopy === 0) {
      this.pricePerCopy = undefined;
    }
  }

  if (typeof next === "function") {
    next();
  }
});

// Unique combination of category and value
serviceOptionSchema.index({ category: 1, value: 1 }, { unique: true });

export default mongoose.model("ServiceOption", serviceOptionSchema);
