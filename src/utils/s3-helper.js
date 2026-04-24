import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import crypto from "crypto";

const s3 = new S3Client({
  region: process.env.AWS_S3_REGION || "ap-south-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

const BUCKET = process.env.AWS_S3_BUCKET || "printemporium-orders";

/**
 * Upload a base64 data URL to S3.
 * @param {string} base64Data - Data URL (e.g., "data:application/pdf;base64,...")
 * @param {string} folder - S3 folder path (e.g., "orders/originals")
 * @param {string} fileName - File name with extension
 * @returns {Promise<{key: string}>} - The S3 object key
 */
export const uploadToS3 = async (base64Data, folder, fileName) => {
  // Extract the base64 content and content type
  const matches = base64Data.match(/^data:(.+);base64,(.+)$/s);
  if (!matches) {
    throw new Error("Invalid base64 data URL format");
  }

  const contentType = matches[1];
  const base64Content = matches[2].replace(/\s/g, "");
  const buffer = Buffer.from(base64Content, "base64");

  // Generate unique key to avoid collisions
  const uniqueId = crypto.randomBytes(8).toString("hex");
  const key = `${folder}/${uniqueId}_${fileName}`;

  await s3.send(new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    Body: buffer,
    ContentType: contentType,
  }));

  return { key };
};

/**
 * Generate a presigned download URL for an S3 object.
 * @param {string} key - The S3 object key
 * @param {number} expiresIn - URL expiry in seconds (default: 1 hour)
 * @returns {Promise<string>} - The presigned URL
 */
export const getS3Url = async (key, expiresIn = 3600) => {
  if (!key) return null;
  // If it's already a URL (legacy Cloudinary), return as-is
  if (key.startsWith("http")) return key;

  const command = new GetObjectCommand({
    Bucket: BUCKET,
    Key: key,
  });

  return getSignedUrl(s3, command, { expiresIn });
};

/**
 * Delete an object from S3.
 * @param {string} key - The S3 object key
 */
export const deleteFromS3 = async (key) => {
  if (!key || key.startsWith("http")) return;

  try {
    await s3.send(new DeleteObjectCommand({
      Bucket: BUCKET,
      Key: key,
    }));
  } catch (_) {
  }
};
