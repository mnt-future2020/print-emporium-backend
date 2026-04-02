import ServiceOption from "../models/ServiceOption.js";
import Service from "../models/Service.js";

export const seedData = async () => {
  console.log("🌱 Seeding data...");

  try {
    // --- 1. Seed Service Options ---
    const options = [
      // Print Types
      {
        category: "printType",
        label: "Black & White",
        value: "black-white",
        pricePerPage: 2,
        isActive: true,
      },
      {
        category: "printType",
        label: "Color",
        value: "color",
        pricePerPage: 10,
        isActive: true,
      },

      // Paper Sizes
      {
        category: "paperSize",
        label: "A4",
        value: "a4",
        pricePerPage: 0,
        isActive: true,
      },
      {
        category: "paperSize",
        label: "A3",
        value: "a3",
        pricePerPage: 5,
        isActive: true,
      },

      // Paper Types
      {
        category: "paperType",
        label: "Standard",
        value: "standard",
        pricePerPage: 0,
        isActive: true,
      },
      {
        category: "paperType",
        label: "Bond Paper",
        value: "bond",
        pricePerPage: 2,
        isActive: true,
      },
      {
        category: "paperType",
        label: "Glossy",
        value: "glossy",
        pricePerPage: 5,
        isActive: true,
      },

      // GSM
      {
        category: "gsm",
        label: "70 GSM",
        value: "70-gsm",
        pricePerPage: 0,
        isActive: true,
      },
      {
        category: "gsm",
        label: "100 GSM",
        value: "100-gsm",
        pricePerPage: 1,
        isActive: true,
      },

      // Print Sides
      {
        category: "printSide",
        label: "Single Side",
        value: "single-side",
        pricePerPage: 0,
        isActive: true,
      },
      {
        category: "printSide",
        label: "Double Side",
        value: "double-side",
        pricePerPage: 0,
        isActive: true,
      },

      // Binding Options (New Schema: minPages & fixedPrice)
      {
        category: "bindingOption",
        label: "No Binding",
        value: "no-binding",
        minPages: 0,
        fixedPrice: 0,
        isActive: true,
      },

      {
        category: "bindingOption",
        label: "Staple",
        value: "staple",
        minPages: 1, // Unique start page
        fixedPrice: 10,
        isActive: true,
      },
      {
        category: "bindingOption",
        label: "Spiral Binding",
        value: "spiral-binding",
        minPages: 1, // Fallback/Display
        fixedPrice: 50, // Fallback Base
        priceRanges: [
          { min: 1, max: 49, price: 50 },
          { min: 50, max: 500, price: 80 },
        ],
        isActive: true,
      },
      {
        category: "bindingOption",
        label: "Soft Cover",
        value: "soft-cover",
        minPages: 100,
        fixedPrice: 150,
        isActive: true,
      },
      {
        category: "bindingOption",
        label: "Hard Cover",
        value: "hard-cover",
        minPages: 200,
        fixedPrice: 300,
        isActive: true,
      },
    ];

    for (const opt of options) {
      await ServiceOption.findOneAndUpdate(
        { category: opt.category, value: opt.value },
        opt,
        { upsert: true, new: true },
      );
    }
    console.log("✅ Service options seeded");

    // --- 2. Seed Services ---
    const documentPrinting = {
      name: "Document Printing",
      basePricePerPage: 1, // Base cost
      status: "active",
      customQuotation: false,
      printTypes: [
        { value: "black-white", pricePerPage: 2 },
        { value: "color", pricePerPage: 10 },
      ],
      paperSizes: [
        { value: "a4", pricePerPage: 0 },
        { value: "a3", pricePerPage: 5 },
      ],
      paperTypes: [
        { value: "standard", pricePerPage: 0 },
        { value: "bond", pricePerPage: 2 },
        { value: "glossy", pricePerPage: 5 },
      ],
      gsmOptions: [
        { value: "70-gsm", pricePerPage: 0 },
        { value: "100-gsm", pricePerPage: 1 },
      ],
      printSides: [
        { value: "single-side", pricePerPage: 0 },
        { value: "double-side", pricePerPage: 0 }, // usually same price, just saves paper
      ],
      bindingOptions: [
        { value: "no-binding", minPages: 0, fixedPrice: 0 },
        { value: "staple", minPages: 1, fixedPrice: 10 },
        {
          value: "spiral-binding",
          minPages: 1,
          fixedPrice: 50,
          priceRanges: [
            { min: 1, max: 49, price: 50 },
            { min: 50, max: 500, price: 80 },
          ],
        },
        { value: "soft-cover", minPages: 100, fixedPrice: 150 },
        { value: "hard-cover", minPages: 200, fixedPrice: 300 },
      ],
    };

    await Service.findOneAndUpdate(
      { name: documentPrinting.name },
      documentPrinting,
      { upsert: true, new: true },
    );
    console.log('✅ Default service "Document Printing" seeded');
  } catch (error) {
    console.error("❌ Error seeding data:", error);
  }
};
