import Service from "../models/Service.js";
import {
  uploadToCloudinary,
  deleteFromCloudinary,
  getUrlFromPublicId,
  getPublicIdFromUrl,
} from "../utils/cloudinary-helper.js";

// Get all services
export const getAllServices = async (req, res) => {
  try {
    // Set cache control headers to prevent caching
    res.set({
      "Cache-Control": "no-cache, no-store, must-revalidate",
      Pragma: "no-cache",
      Expires: "0",
    });

    const { status } = req.query;
    const query = {};

    if (status) {
      query.status = status;
    }

    const services = await Service.find(query).sort({ name: 1 });

    // Resolve image URLs
    const servicesWithUrls = services.map((service) => ({
      ...service._doc,
      image: service.image ? getUrlFromPublicId(service.image) : null,
    }));

    return res.status(200).json({
      success: true,
      data: servicesWithUrls,
    });
  } catch (error) {
    console.error("Get services error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch services",
      error: error.message,
    });
  }
};

// Get a single service by ID
export const getServiceById = async (req, res) => {
  try {
    // Set cache control headers to prevent caching
    res.set({
      "Cache-Control": "no-cache, no-store, must-revalidate",
      Pragma: "no-cache",
      Expires: "0",
    });

    const { id } = req.params;
    const service = await Service.findById(id);

    if (!service) {
      return res.status(404).json({
        success: false,
        message: "Service not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        ...service._doc,
        image: service.image ? getUrlFromPublicId(service.image) : null,
      },
    });
  } catch (error) {
    console.error("Get service by ID error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch service",
      error: error.message,
    });
  }
};

// Create or update a service
export const upsertService = async (req, res) => {
  try {
    const {
      id,
      name,
      image,
      basePricePerPage,
      basePriceRanges,
      customQuotation,
      printTypes,
      paperSizes,
      paperTypes,
      gsmOptions,
      printSides,
      bindingOptions,
      status,
    } = req.body;

    // Validate service name
    if (!name || typeof name !== "string" || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: "Service name is required",
      });
    }

    if (name.trim().length < 2) {
      return res.status(400).json({
        success: false,
        message: "Service name must be at least 2 characters",
      });
    }

    if (name.trim().length > 100) {
      return res.status(400).json({
        success: false,
        message: "Service name must be less than 100 characters",
      });
    }

    // Check for duplicate service name
    const duplicateQuery = { name: { $regex: new RegExp(`^${name.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, "i") } };
    if (id) {
      duplicateQuery._id = { $ne: id };
    }
    const duplicate = await Service.findOne(duplicateQuery);
    if (duplicate) {
      return res.status(400).json({
        success: false,
        message: "A service with this name already exists",
      });
    }

    // Validate base price
    if (basePricePerPage !== undefined && basePricePerPage !== null) {
      if (typeof basePricePerPage !== "number" || basePricePerPage < 0) {
        return res.status(400).json({
          success: false,
          message: "Base price per page cannot be negative",
        });
      }
    }

    const hasRanges =
      Array.isArray(basePriceRanges) && basePriceRanges.length > 0;

    if (
      !customQuotation &&
      (!basePricePerPage || basePricePerPage <= 0) &&
      !hasRanges
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Base price (fallback or at least one price range) is required for non-quotation services",
      });
    }

    if (hasRanges) {
      for (const range of basePriceRanges) {
        if (
          typeof range.min !== "number" ||
          typeof range.max !== "number" ||
          typeof range.price !== "number"
        ) {
          return res.status(400).json({
            success: false,
            message: "Each base price range must have numeric min, max, and price",
          });
        }
        if (range.min < 0 || range.max < 0 || range.price < 0) {
          return res.status(400).json({
            success: false,
            message: "Base price ranges cannot have negative values",
          });
        }
        if (range.min >= range.max) {
          return res.status(400).json({
            success: false,
            message: "Base price range min must be less than max",
          });
        }
      }
    }

    // Validate status
    if (status && !["active", "inactive"].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Status must be 'active' or 'inactive'",
      });
    }

    // Validate required options for non-quotation services
    if (!customQuotation) {
      if (!printTypes || !Array.isArray(printTypes) || printTypes.length === 0) {
        return res.status(400).json({
          success: false,
          message: "At least one print type is required",
        });
      }

      if (!paperSizes || !Array.isArray(paperSizes) || paperSizes.length === 0) {
        return res.status(400).json({
          success: false,
          message: "At least one paper size is required",
        });
      }
    }

    // Validate option pricing rules
    const optionArrays = [
      { name: "printTypes", data: printTypes },
      { name: "paperSizes", data: paperSizes },
      { name: "paperTypes", data: paperTypes },
      { name: "gsmOptions", data: gsmOptions },
      { name: "printSides", data: printSides },
      { name: "bindingOptions", data: bindingOptions },
    ];

    for (const { name: arrayName, data } of optionArrays) {
      if (data && Array.isArray(data)) {
        for (const option of data) {
          // Each option must have a value
          if (!option.value || typeof option.value !== "string" || !option.value.trim()) {
            return res.status(400).json({
              success: false,
              message: `Each option in ${arrayName} must have a value`,
            });
          }

          const isBinding = arrayName === "bindingOptions";

          // Validate binding options
          if (isBinding) {
            if ((option.fixedPrice || 0) < 0) {
              return res.status(400).json({
                success: false,
                message: `Binding option "${option.value}" cannot have a negative fixed price`,
              });
            }
            if (option.priceRanges && Array.isArray(option.priceRanges)) {
              for (const range of option.priceRanges) {
                if (range.min < 0 || range.max < 0 || range.price < 0) {
                  return res.status(400).json({
                    success: false,
                    message: `Binding option "${option.value}" has negative values in price ranges`,
                  });
                }
                if (range.min >= range.max) {
                  return res.status(400).json({
                    success: false,
                    message: `Binding option "${option.value}" has invalid range: min must be less than max`,
                  });
                }
              }
            }
            continue;
          }

          // Validate non-binding options: cannot have both pricing types
          if ((option.pricePerPage || 0) !== 0 && (option.pricePerCopy || 0) !== 0) {
            return res.status(400).json({
              success: false,
              message: `Cannot set both pricePerPage and pricePerCopy for ${arrayName}. Please choose only one pricing type per option.`,
            });
          }

          // Validate no negative prices (except for printSides)
          if (arrayName !== "printSides" && ((option.pricePerPage || 0) < 0 || (option.pricePerCopy || 0) < 0)) {
            return res.status(400).json({
              success: false,
              message: `Option "${option.value}" in ${arrayName} cannot have negative prices`,
            });
          }
        }
      }
    }

    let existingService = null;
    if (id) {
      existingService = await Service.findById(id);
    }

    // Handle Image upload
    let uploadedImageValue = undefined;
    const imageData =
      typeof image === "object" && image !== null ? image.data : image;
    const imageName =
      typeof image === "object" && image !== null ? image.name : null;

    if (imageData && imageData.startsWith("data:image")) {
      // Delete old image if exists
      if (existingService?.image) {
        await deleteFromCloudinary(existingService.image);
      }

      const customPublicId = imageName ? imageName.split(".")[0] : null;

      const uploadResult = await uploadToCloudinary(
        imageData,
        "printemporium/images/services",
        customPublicId,
      );
      uploadedImageValue = uploadResult.public_id;
    } else if (typeof imageData === "string" && imageData.startsWith("http")) {
      const publicId = getPublicIdFromUrl(imageData);
      if (publicId) {
        uploadedImageValue = publicId;
      }
    } else if (imageData === null) {
      if (existingService?.image) {
        await deleteFromCloudinary(existingService.image);
      }
      uploadedImageValue = null;
    }

    const serviceData = {
      name,
      basePricePerPage,
      basePriceRanges: hasRanges ? basePriceRanges : [],
      customQuotation,
      printTypes,
      paperSizes,
      paperTypes,
      gsmOptions,
      printSides,
      bindingOptions,
      status,
      lastUpdatedBy: req.user?.id || "admin",
    };

    if (uploadedImageValue !== undefined) {
      serviceData.image = uploadedImageValue;
    }

    let service;
    if (id) {
      service = await Service.findByIdAndUpdate(id, serviceData, {
        new: true,
        runValidators: true,
      });
    } else {
      service = new Service(serviceData);
      await service.save();
    }

    return res.status(200).json({
      success: true,
      message: "Service saved successfully",
      data: {
        ...service._doc,
        image: service.image ? getUrlFromPublicId(service.image) : null,
      },
    });
  } catch (error) {
    console.error("Save service error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to save service",
      error: error.message,
    });
  }
};

// Delete a service
export const deleteService = async (req, res) => {
  try {
    const { id } = req.params;
    const service = await Service.findById(id);

    if (!service) {
      return res.status(404).json({
        success: false,
        message: "Service not found",
      });
    }

    // Delete image from Cloudinary if exists
    if (service.image) {
      await deleteFromCloudinary(service.image);
    }

    await Service.findByIdAndDelete(id);

    return res.status(200).json({
      success: true,
      message: "Service deleted successfully",
    });
  } catch (error) {
    console.error("Delete service error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to delete service",
      error: error.message,
    });
  }
};
