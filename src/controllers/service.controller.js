import Service from "../models/Service.js";
import ServiceOption from "../models/ServiceOption.js";
import {
  uploadToCloudinary,
  deleteFromCloudinary,
  getUrlFromPublicId,
  getPublicIdFromUrl,
} from "../utils/cloudinary-helper.js";

// Generate a URL-safe slug from a service name (matches Service model's slugify).
const slugify = (str) =>
  String(str || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

// Admin selects WHICH binding options apply per-service (storing only the `value`).
// Pricing is hydrated at read time from the global ServiceOption master collection
// so any global edit (price change, range update, etc.) reflects instantly in every
// service that has that binding selected.
const buildGlobalBindingMap = async () => {
  const opts = await ServiceOption.find({
    category: "bindingOption",
  });
  const map = new Map();
  for (const o of opts) {
    map.set(o.value, {
      value: o.value,
      label: o.label,
      fixedPrice: o.fixedPrice,
      pricePerPage: o.pricePerPage,
      pricePerCopy: o.pricePerCopy,
      minPages: o.minPages,
      priceRanges: o.priceRanges,
      isActive: o.isActive,
    });
  }
  return map;
};

// Resolve a service's selected binding values against the global map.
// - Only include active options
// - Preserve admin's selection order from the service document
const hydrateBindingOptions = (selectedBindings, globalMap) => {
  if (!Array.isArray(selectedBindings)) return [];
  const result = [];
  for (const sel of selectedBindings) {
    const key = typeof sel === "string" ? sel : sel?.value;
    if (!key) continue;
    const fresh = globalMap.get(key);
    if (fresh && fresh.isActive) {
      result.push(fresh);
    }
  }
  return result;
};

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
      // Support comma-separated statuses, e.g. "active,coming-soon"
      const statuses = String(status).split(",").map((s) => s.trim()).filter(Boolean);
      query.status = statuses.length > 1 ? { $in: statuses } : statuses[0];
    }

    const [services, globalBindingMap] = await Promise.all([
      Service.find(query).sort({ name: 1 }),
      buildGlobalBindingMap(),
    ]);

    // Resolve image URLs + hydrate selected binding options from the global master
    const servicesWithUrls = services.map((service) => ({
      ...service._doc,
      image: service.image ? getUrlFromPublicId(service.image) : null,
      bindingOptions: hydrateBindingOptions(
        service._doc.bindingOptions,
        globalBindingMap,
      ),
    }));

    return res.status(200).json({
      success: true,
      data: servicesWithUrls,
    });
  } catch (error) {
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
    const [service, globalBindingMap] = await Promise.all([
      Service.findById(id),
      buildGlobalBindingMap(),
    ]);

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
        bindingOptions: hydrateBindingOptions(
          service._doc.bindingOptions,
          globalBindingMap,
        ),
      },
    });
  } catch (error) {
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
      description,
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

    // Validate description length (optional field)
    if (typeof description === "string" && description.trim().length > 1000) {
      return res.status(400).json({
        success: false,
        message: "Description must be less than 1000 characters",
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
    if (status && !["active", "inactive", "coming-soon"].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Status must be 'active', 'inactive', or 'coming-soon'",
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
    // Note: bindingOptions excluded — managed globally via ServiceOption
    const optionArrays = [
      { name: "printTypes", data: printTypes },
      { name: "paperSizes", data: paperSizes },
      { name: "paperTypes", data: paperTypes },
      { name: "gsmOptions", data: gsmOptions },
      { name: "printSides", data: printSides },
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
      slug: slugify(name),
      description: typeof description === "string" ? description.trim() : "",
      basePricePerPage,
      basePriceRanges: hasRanges ? basePriceRanges : [],
      customQuotation,
      printTypes,
      paperSizes,
      paperTypes,
      gsmOptions,
      printSides,
      // Store ONLY the binding `value` references — pricing is hydrated from
      // the global ServiceOption master at fetch time
      bindingOptions: Array.isArray(bindingOptions)
        ? bindingOptions
            .map((b) => (typeof b === "string" ? b : b?.value))
            .filter(Boolean)
            .map((value) => ({ value }))
        : [],
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
    return res.status(500).json({
      success: false,
      message: "Failed to delete service",
      error: error.message,
    });
  }
};
