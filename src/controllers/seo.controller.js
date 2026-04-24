import SEOSettings from "../models/SEOSettings.js";
import {
  uploadToCloudinary,
  deleteFromCloudinary,
  getUrlFromPublicId,
  getPublicIdFromUrl,
} from "../utils/cloudinary-helper.js";

// Get all SEO settings
export const getAllSEOSettings = async (req, res) => {
  try {
    const seoSettings = await SEOSettings.find().sort({ pageName: 1 });

    // Convert ogImage public IDs to URLs
    const settingsWithUrls = seoSettings.map((setting) => ({
      ...setting._doc,
      ogImage: setting.ogImage ? getUrlFromPublicId(setting.ogImage) : null,
    }));

    return res.status(200).json({
      success: true,
      data: settingsWithUrls,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch SEO settings",
      error: error.message,
    });
  }
};

// Get SEO settings for a specific page
export const getSEOSettingsByPage = async (req, res) => {
  try {
    const { pageName } = req.params;

    const seoSetting = await SEOSettings.findOne({ pageName });

    if (!seoSetting) {
      return res.status(404).json({
        success: false,
        message: "SEO settings not found for this page",
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        ...seoSetting._doc,
        ogImage: seoSetting.ogImage
          ? getUrlFromPublicId(seoSetting.ogImage)
          : null,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch SEO settings",
      error: error.message,
    });
  }
};

// Create or update SEO settings for a page
export const upsertSEOSettings = async (req, res) => {
  try {
    const { pageName, metaTitle, metaDescription, keywords, ogImage } =
      req.body;

    if (!pageName) {
      return res.status(400).json({
        success: false,
        message: "Page name is required",
      });
    }

    // Handle OG Image upload if it's a base64 string or object
    let uploadedOgImageValue = undefined;
    const ogImageData =
      typeof ogImage === "object" && ogImage !== null
        ? ogImage.data
        : ogImage;
    const ogImageName =
      typeof ogImage === "object" && ogImage !== null ? ogImage.name : null;

    let existingSetting = await SEOSettings.findOne({ pageName });

    if (ogImageData && ogImageData.startsWith("data:image")) {
      // Delete old image if exists
      if (existingSetting?.ogImage) {
        await deleteFromCloudinary(existingSetting.ogImage);
      }

      const customPublicId = ogImageName ? ogImageName.split(".")[0] : null;

      const uploadResult = await uploadToCloudinary(
        ogImageData,
        "printemporium/images/seo",
        customPublicId
      );
      uploadedOgImageValue = uploadResult.public_id;
    } else if (
      typeof ogImageData === "string" &&
      ogImageData.startsWith("http")
    ) {
      const publicId = getPublicIdFromUrl(ogImageData);
      if (publicId) {
        uploadedOgImageValue = publicId;
      }
    } else if (
      typeof ogImageData === "string" &&
      ogImageData &&
      !ogImageData.startsWith("/images/")
    ) {
      uploadedOgImageValue = ogImageData;
    } else if (ogImageData === null) {
      if (existingSetting?.ogImage) {
        await deleteFromCloudinary(existingSetting.ogImage);
      }
      uploadedOgImageValue = null;
    }

    const updateData = {
      pageName,
      metaTitle,
      metaDescription,
      keywords,
      lastUpdatedBy: req.user?.id || "admin",
    };

    if (uploadedOgImageValue !== undefined) {
      updateData.ogImage = uploadedOgImageValue;
    }

    const seoSetting = await SEOSettings.findOneAndUpdate(
      { pageName },
      updateData,
      { new: true, upsert: true, runValidators: true }
    );

    return res.status(200).json({
      success: true,
      message: "SEO settings updated successfully",
      data: {
        ...seoSetting._doc,
        ogImage: seoSetting.ogImage
          ? getUrlFromPublicId(seoSetting.ogImage)
          : null,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to update SEO settings",
      error: error.message,
    });
  }
};

// Delete SEO settings for a page
export const deleteSEOSettings = async (req, res) => {
  try {
    const { pageName } = req.params;

    const seoSetting = await SEOSettings.findOne({ pageName });

    if (!seoSetting) {
      return res.status(404).json({
        success: false,
        message: "SEO settings not found",
      });
    }

    // Delete OG image from Cloudinary if exists
    if (seoSetting.ogImage) {
      await deleteFromCloudinary(seoSetting.ogImage);
    }

    await SEOSettings.deleteOne({ pageName });

    return res.status(200).json({
      success: true,
      message: "SEO settings deleted successfully",
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to delete SEO settings",
      error: error.message,
    });
  }
};

