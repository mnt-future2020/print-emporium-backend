import ServiceOption from "../models/ServiceOption.js";
// Clean up duplicate service options

// Get all service options (filtered by category if provided)
export const getAllServiceOptions = async (req, res) => {
  try {
    const { category, activeOnly } = req.query;
    const query = {};
    if (category) {
      query.category = category;
    }
    if (activeOnly === "true") {
      query.isActive = true;
    }
    const options = await ServiceOption.find(query).sort({ label: 1 });
    return res.status(200).json({
      success: true,
      data: options,
    });
  } catch (error) {
    console.error("Get service options error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch service options",
      error: error.message,
    });
  }
};
// Create or Update a service option
export const upsertServiceOption = async (req, res) => {
  try {
    const {
      category,
      label,
      value,
      isActive,
      pricePerPage,
      pricePerCopy,
      minPages,
      fixedPrice,
      priceRanges,
      id,
    } = req.body;
    if (!category || !label || !value) {
      return res.status(400).json({
        success: false,
        message: "Category, Label, and Value are required",
      });
    }

    // Validate: Only one pricing type can be set (skip for bindingOption if fixedPrice or priceRanges is used)
    if (category !== "bindingOption" && Number(pricePerPage || 0) !== 0 && Number(pricePerCopy || 0) !== 0) {
      return res.status(400).json({
        success: false,
        message:
          "Cannot set both pricePerPage and pricePerCopy. Please choose only one pricing type.",
      });
    }

    let option;
    if (id) {
      option = await ServiceOption.findByIdAndUpdate(
        id,
        {
          category,
          label,
          value,
          isActive,
          pricePerPage,
          pricePerCopy,
          minPages,
          fixedPrice,
          priceRanges,
        },
        { new: true, runValidators: true },
      );
    } else {
      // Check if it already exists for this category/value
      const existing = await ServiceOption.findOne({ category, value });
      if (existing) {
        return res.status(400).json({
          success: false,
          message: `This option already exists in the ${category} category`,
        });
      }
      option = new ServiceOption({
        category,
        label,
        value,
        isActive,
        pricePerPage,
        pricePerCopy,
        minPages,
        fixedPrice,
        priceRanges,
      });
      await option.save();
    }
    return res.status(200).json({
      success: true,
      message: "Service option saved successfully",
      data: option,
    });
  } catch (error) {
    console.error("Save service option error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to save service option",
      error: error.message,
    });
  }
};
// Delete a service option
export const deleteServiceOption = async (req, res) => {
  try {
    const { id } = req.params;
    const option = await ServiceOption.findByIdAndDelete(id);
    if (!option) {
      return res.status(404).json({
        success: false,
        message: "Service option not found",
      });
    }
    return res.status(200).json({
      success: true,
      message: "Service option deleted successfully",
    });
  } catch (error) {
    console.error("Delete service option error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to delete service option",
      error: error.message,
    });
  }
};
