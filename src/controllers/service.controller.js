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
      customQuotation,
      printTypes,
      paperSizes,
      paperTypes,
      gsmOptions,
      printSides,
      bindingOptions,
      status,
    } = req.body;

    if (!name) {
      return res.status(400).json({
        success: false,
        message: "Service name is required",
      });
    }

    // Validate: Only one pricing type can be set for each option
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
          // Binding options can have fixedPrice OR priceRanges, so we skip the standard check
          const isBinding = arrayName === "bindingOptions";
          if (
            isBinding &&
            ((option.fixedPrice || 0) > 0 ||
              (option.priceRanges && option.priceRanges.length > 0))
          ) {
            continue;
          }

          if (option.pricePerPage > 0 && option.pricePerCopy > 0) {
            return res.status(400).json({
              success: false,
              message: `Cannot set both pricePerPage and pricePerCopy for ${arrayName}. Please choose only one pricing type per option.`,
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
