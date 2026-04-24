import cloudinary from "../config/cloudinary.js";

/**
 * Extracts the public ID from a Cloudinary URL.
 * @param {string} url - The Cloudinary URL.
 * @returns {string|null} - The public ID or null.
 */
export const getPublicIdFromUrl = (url) => {
  if (!url || !url.includes("res.cloudinary.com")) return null;

  // Example URL: https://res.cloudinary.com/cloud_name/image/upload/f_auto,q_auto/v123456789/folder/public_id.jpg?query=params
  // We need to handle:
  // 1. Transformations (f_auto,q_auto)
  // 2. Version (v123456789)
  // 3. Folder structure (folder/public_id)
  try {
    // First, remove any query parameters
    const urlWithoutQuery = url.split("?")[0];
    
    const parts = urlWithoutQuery.split("/upload/");
    if (parts.length < 2) return null;

    const afterUpload = parts[1];
    const pathParts = afterUpload.split("/");

    // Find the LAST index of the version part (e.g., "v123456789")
    // searching from the end ensures we skip any double-encoded parts
    let versionIndex = -1;
    for (let i = pathParts.length - 1; i >= 0; i--) {
      if (pathParts[i].match(/^v\d+$/)) {
        versionIndex = i;
        break;
      }
    }

    // If version is found, the public ID starts *after* the version
    // If not found, we assume it starts at the beginning (index 0) 
    // UNLESS the first part looks like a specific transformation, but standard behavior usually implies version presence for signed URLs
    // For safety, we'll try to identify common transformation chars if version isn't found, but version search is the most robust.
    const startIndex = versionIndex !== -1 ? versionIndex + 1 : 0;

    const publicIdWithExt = pathParts.slice(startIndex).join("/");
    const publicId = publicIdWithExt.split(".")[0]; // remove extension

    return publicId;
  } catch (error) {
    return null;
  }
};

/**
 * Generates a secure URL from a Cloudinary public ID.
 * @param {string} publicId - The public ID.
 * @param {Object} customOptions - Optional transformation options.
 * @returns {string|null} - The secure URL.
 */
export const getUrlFromPublicId = (publicId, customOptions = {}) => {
  if (!publicId) return null;
  // If it's already a URL, return it
  if (publicId.startsWith("http")) return publicId;

  // Check if this is a PDF file
  const isPdf = publicId.toLowerCase().includes("pdf") || 
                publicId.toLowerCase().endsWith(".pdf");

  const options = {
    secure: true,
    resource_type: "image", // PDFs are uploaded as image resource type
    ...customOptions,
  };

  // For PDFs, ensure proper format and flags
  if (isPdf) {
    options.format = "pdf";
    options.flags = "attachment"; // Force download instead of inline display
    // Remove any auto format conversion for PDFs
    delete options.fetch_format;
    delete options.quality;
  } else {
    // For images, use auto optimization
    options.quality = "auto";
    options.fetch_format = "auto";
  }

  return cloudinary.url(publicId, options);
};

/**
 * Uploads a base64 image or a file path to Cloudinary.
 * @param {string} file - The file to upload (base64 string or path).
 * @param {string} folder - The folder to upload to.
 * @param {string} publicId - Optional public ID (filename).
 * @param {Object} additionalOptions - Additional upload options.
 * @returns {Promise<Object>} - Object containing secure_url and public_id.
 */
export const uploadToCloudinary = async (
  file,
  folder = "print_emporium",
  customPublicId = null,
  additionalOptions = {}
) => {
  try {
    const options = {
      folder,
      resource_type: "auto",
      ...additionalOptions,
    };

    if (customPublicId) {
      options.public_id = customPublicId;
    }

    const result = await cloudinary.uploader.upload(file, options);
    
    // Clean the public_id to ensure no query parameters
    const cleanPublicId = result.public_id ? result.public_id.split("?")[0] : result.public_id;
    
    return {
      secure_url: result.secure_url,
      public_id: cleanPublicId,
    };
  } catch (error) {
    throw new Error("Failed to upload image to Cloudinary");
  }
};

/**
 * Uploads a file to Cloudinary as raw (preserves original format).
 * @param {string} file - The file to upload (base64 string or path).
 * @param {string} folder - The folder to upload to.
 * @param {string} publicId - Optional public ID (filename).
 * @returns {Promise<Object>} - Object containing secure_url and public_id.
 */
export const uploadRawToCloudinary = async (
  file,
  folder = "print_emporium",
  customPublicId = null
) => {
  try {
    const options = {
      folder,
      resource_type: "raw", // Preserves original file format
    };

    if (customPublicId) {
      options.public_id = customPublicId;
    }

    const result = await cloudinary.uploader.upload(file, options);
    
    // Clean the public_id to ensure no query parameters
    const cleanPublicId = result.public_id ? result.public_id.split("?")[0] : result.public_id;
    
    return {
      secure_url: result.secure_url,
      public_id: cleanPublicId,
    };
  } catch (error) {
    throw new Error("Failed to upload file to Cloudinary");
  }
};

/**
 * Generates a secure URL from a Cloudinary public ID for raw files.
 * @param {string} publicId - The public ID.
 * @param {string} resourceType - The resource type (image, raw, video).
 * @returns {string|null} - The secure URL.
 */
export const getRawUrlFromPublicId = (publicId) => {
  if (!publicId) return null;
  // If it's already a URL, return it
  if (publicId.startsWith("http")) return publicId;

  return cloudinary.url(publicId, {
    secure: true,
    resource_type: "raw",
  });
};

/**
 * Deletes an asset from Cloudinary using its URL or public ID.
 * @param {string} identifier - The secure URL or public ID of the asset to delete.
 */
export const deleteFromCloudinary = async (identifier) => {
  try {
    // If it's a full URL, extract the public ID. Otherwise, assume it's already a public ID.
    const publicId = identifier.startsWith("http")
      ? getPublicIdFromUrl(identifier)
      : identifier;

    if (publicId && !publicId.startsWith("/images/")) {
      // Don't try to delete local fallback images
      await cloudinary.uploader.destroy(publicId);
    }
  } catch (error) {
  }
};
