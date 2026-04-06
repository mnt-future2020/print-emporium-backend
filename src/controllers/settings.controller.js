import GeneralSettings from "../models/GeneralSettings.js";
import PricingSettings from "../models/PricingSettings.js";
import User from "../models/User.js";
import nodemailer from "nodemailer";
import { getEmailConfig } from "../config/sendmail.js";
import {
  uploadToCloudinary,
  deleteFromCloudinary,
  getUrlFromPublicId,
  getPublicIdFromUrl, // Add this import
} from "../utils/cloudinary-helper.js";

/**
 * Helper function to generate admin email verification HTML
 */
const generateAdminEmailVerificationHTML = (
  companyName,
  verificationUrl,
  companyLogo,
  frontendUrl,
) => {
  // Ensure logo URL is properly formatted
  let logoHtml = "";
  if (companyLogo) {
    // Add query parameters to bust cache and ensure fresh load
    const logoUrl = companyLogo.includes("?")
      ? `${companyLogo}&t=${Date.now()}`
      : `${companyLogo}?t=${Date.now()}`;

    logoHtml = `
      <img 
        src="${logoUrl}" 
        alt="${companyName} Logo" 
        class="company-logo"
        width="180"
        height="70"
        style="max-width: 180px; max-height: 70px; display: block; margin: 0 auto 20px auto; object-fit: contain;"
      />
    `;
  } else {
    logoHtml = `<div class="logo-text">${companyName}</div>`;
  }

  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <meta http-equiv="X-UA-Compatible" content="IE=edge">
      <title>Verify Your Admin Email - ${companyName}</title>
      <!--[if mso]>
      <style type="text/css">
        body, table, td { font-family: Arial, Helvetica, sans-serif !important; }
      </style>
      <![endif]-->
    </head>
    <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #374151; background-color: #f8fafc;">
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f8fafc; padding: 20px 0;">
        <tr>
          <td align="center">
            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="680" style="max-width: 680px; background: #ffffff; border-radius: 16px; box-shadow: 0 10px 25px rgba(0, 0, 0, 0.08); overflow: hidden;">
              
              <!-- Header -->
              <tr>
                <td style="background: linear-gradient(135deg, #0021a0 0%, #0033cc 100%); padding: 50px 40px; text-align: center;">
                  ${logoHtml}
                  <div style="color: rgba(255, 255, 255, 0.9); font-size: 14px; letter-spacing: 1.2px; text-transform: uppercase; font-weight: 500;">
                    Admin Portal Verification
                  </div>
                </td>
              </tr>
              
              <!-- Content -->
              <tr>
                <td style="padding: 50px 40px; background: #ffffff;">
                  <div style="font-size: 22px; font-weight: 700; color: #111827; margin-bottom: 24px; letter-spacing: -0.3px;">
                    Verify Your New Admin Email Address
                  </div>
                  <div style="color: #4b5563; font-size: 16px; line-height: 1.8; margin-bottom: 32px;">
                    You have requested to change the admin email for <span class="message-highlight" style="font-weight: 600; color: #0021a0;">${companyName}</span>. Please verify this new email address by clicking the button below to complete the process.
                  </div>
                  
                  <!-- CTA Button -->
                  <div style="text-align: center; margin: 40px 0;">
                    <a href="${verificationUrl}" style="display: inline-block; background: linear-gradient(135deg, #0021a0 0%, #0033cc 100%); color: #ffffff; padding: 16px 40px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px; letter-spacing: 0.5px; box-shadow: 0 4px 15px rgba(0, 33, 160, 0.3);">
                      Verify Email Address
                    </a>
                  </div>
                  
                  <!-- Link Section -->
                  <div style="margin-top: 32px; padding: 24px; background: #f8fafc; border-radius: 8px; border-left: 4px solid #0021a0;">
                    <div style="color: #6b7280; font-size: 13px; font-weight: 600; text-transform: uppercase; margin-bottom: 12px; letter-spacing: 0.5px;">
                      Or copy this link:
                    </div>
                    <div style="word-break: break-all; color: #0021a0; font-size: 14px; font-family: 'Courier New', monospace; line-height: 1.6;">
                      ${verificationUrl}
                    </div>
                  </div>
                  
                  <div style="color: #6b7280; font-size: 14px; margin-top: 24px; line-height: 1.7; background: #fef3c7; border-left: 4px solid #f59e0b; padding: 16px; border-radius: 6px;">
                    <strong style="color: #92400e;">⚠️ Security Note:</strong> This verification link will expire in 24 hours. If you did not request this change or have any questions, please contact your administrator immediately.
                  </div>
                </td>
              </tr>
              
              <!-- Footer -->
              <tr>
                <td style="background: #f3f4f6; padding: 30px 40px; text-align: center; border-top: 1px solid #e5e7eb;">
                  <div style="color: #6b7280; font-size: 13px; line-height: 1.6;">
                    © ${new Date().getFullYear()} ${companyName}. All rights reserved.<br>
                    <a href="${frontendUrl}" style="color: #0021a0; text-decoration: none;">Visit our website</a> | 
                    <a href="${frontendUrl}/contact" style="color: #0021a0; text-decoration: none;">Contact support</a>
                  </div>
                </td>
              </tr>
              
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;
};

// Get all settings (General/Email only)
export const getSettings = async (req, res) => {
  try {
    let generalSettings = await GeneralSettings.findOne({
      settingsId: "global",
    });

    // Create default settings if they don't exist
    if (!generalSettings) {
      generalSettings = await GeneralSettings.create({
        settingsId: "global",
        companyName: "The Print Emporium",
        companyEmail: "info@printemporium.com",
        companyPhone: "+91 431 2345678",
        whatsappNumber: "+91 9876543210",
        companyAddress:
          "No. 45, Main Road, Thillai Nagar, Trichy – 620018, Tamil Nadu, India",
        companyDescription:
          "Your trusted partner for high-quality printing solutions in Trichy. From business cards to large format prints, we deliver excellence in every project.",
        companyLogo: "/images/logo/logo.webp",
        favicon: "/images/favicon/favicon.ico",
        workingHours: "Mon – Sat: 9:00 AM – 8:00 PM\nSun: 10:00 AM – 6:00 PM",
        latitude: "10.8050456",
        longitude: "78.6868581",
        googleMapEmbed:
          "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3919.2258756337205!2d78.6868581!3d10.8050456!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x3baaf72c5c0940ad%3A0x2748d41a1133m31!2sThillai%20Nagar%2C%20Tiruchirappalli%2C%20Tamil%20Nadu!5e0!3m2!1sen!2sin!4v1234567890",
        socialMedia: {
          facebook: "https://facebook.com/printemporium",
          instagram: "https://instagram.com/printemporium",
          twitter: "https://twitter.com/printemporium",
          linkedin: "https://linkedin.com/company/printemporium",
        },
        gstNumber: "33ABCDE1234F1Z5",
        termsAndConditions:
          "All orders are subject to verification. Prices are inclusive of GST. Delivery charges may apply for orders below ₹500.",
        footerNote:
          "© 2024 The Print Emporium. All rights reserved. Serving Trichy with quality printing since 2020.",
      });
    }

    const data = {
      ...generalSettings._doc,
      companyLogo: getUrlFromPublicId(generalSettings.companyLogo),
      favicon: getUrlFromPublicId(generalSettings.favicon),
    };

    // Prune sensitive fields if not admin (accessed via signature)
    if (!req.user || req.user.role !== "admin") {
      delete data.emailVerificationToken;
      delete data.emailVerificationExpiry;
      delete data.pendingEmailChange;
      delete data._id;
      delete data.__v;
    }

    return res.status(200).json({
      success: true,
      data: data,
    });
  } catch (error) {
    console.error("Get settings error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch settings",
      error: error.message,
    });
  }
};

export const updateGeneralSettings = async (req, res) => {
  try {
    const {
      companyName,
      companyEmail,
      companyPhone,
      whatsappNumber,
      companyAddress,
      companyDescription,
      companyLogo,
      favicon,
      workingHours,
      latitude,
      longitude,
      googleMapEmbed,
      socialMedia,
      gstNumber,
      termsAndConditions,
      footerNote,
      trackingWebsiteUrl,
    } = req.body;

    if (
      !companyName ||
      !companyEmail ||
      !companyPhone ||
      !companyAddress ||
      !companyDescription
    ) {
      return res.status(400).json({
        success: false,
        message: "Required fields are missing",
      });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(companyEmail)) {
      return res.status(400).json({
        success: false,
        message: "Invalid email format",
      });
    }

    let settings = await GeneralSettings.findOne({ settingsId: "global" });
    const oldEmail = settings?.companyEmail || process.env.ADMIN_EMAIL;
    const emailChanged = oldEmail && oldEmail !== companyEmail;

    // Handle Cloudinary upload if companyLogo is a base64 string or an object with data
    let uploadedLogoValue = undefined; // Will remain undefined if not being updated
    const logoData =
      typeof companyLogo === "object" && companyLogo !== null
        ? companyLogo.data
        : companyLogo;
    const logoName =
      typeof companyLogo === "object" && companyLogo !== null
        ? companyLogo.name
        : null;

    if (logoData && logoData.startsWith("data:image")) {
      // New upload - delete old and upload new
      if (settings?.companyLogo) {
        await deleteFromCloudinary(settings.companyLogo);
      }

      // Extract filename without extension for public_id
      const customPublicId = logoName ? logoName.split(".")[0] : null;

      const uploadResult = await uploadToCloudinary(
        logoData,
        "printemporium/images/logo",
        customPublicId,
      );
      uploadedLogoValue = uploadResult.public_id;
    } else if (typeof logoData === "string" && logoData.startsWith("http")) {
      // It's an existing Cloudinary URL - extract and save the public ID
      const publicId = getPublicIdFromUrl(logoData);
      if (publicId) {
        uploadedLogoValue = publicId;
      }
    } else if (
      typeof logoData === "string" &&
      logoData &&
      !logoData.startsWith("/images/")
    ) {
      // It's already a public ID - keep it as-is
      uploadedLogoValue = logoData;
    } else if (logoData === null) {
      // Explicit removal
      if (settings?.companyLogo) {
        await deleteFromCloudinary(settings.companyLogo);
      }
      uploadedLogoValue = null;
    }
    // If logoData is empty string or undefined, uploadedLogoValue remains undefined (no update)

    // Handle Cloudinary upload if favicon is a base64 string or an object
    let uploadedFaviconValue = undefined; // Will remain undefined if not being updated
    const faviconData =
      typeof favicon === "object" && favicon !== null ? favicon.data : favicon;
    const faviconName =
      typeof favicon === "object" && favicon !== null ? favicon.name : null;

    if (faviconData && faviconData.startsWith("data:image")) {
      // New upload - delete old and upload new
      if (settings?.favicon) {
        await deleteFromCloudinary(settings.favicon);
      }

      const customPublicId = faviconName ? faviconName.split(".")[0] : null;

      const uploadResult = await uploadToCloudinary(
        faviconData,
        "printemporium/images/favicon",
        customPublicId,
      );
      uploadedFaviconValue = uploadResult.public_id;
    } else if (
      typeof faviconData === "string" &&
      faviconData.startsWith("http")
    ) {
      // It's an existing Cloudinary URL - extract and save the public ID
      const publicId = getPublicIdFromUrl(faviconData);
      if (publicId) {
        uploadedFaviconValue = publicId;
      }
    } else if (
      typeof faviconData === "string" &&
      faviconData &&
      !faviconData.startsWith("/images/")
    ) {
      // It's already a public ID - keep it as-is
      uploadedFaviconValue = faviconData;
    } else if (faviconData === null) {
      // Explicit removal
      if (settings?.favicon) {
        await deleteFromCloudinary(settings.favicon);
      }
      uploadedFaviconValue = null;
    }
    // If faviconData is empty string or undefined, uploadedFaviconValue remains undefined (no update)

    if (!settings) {
      settings = await GeneralSettings.create({
        settingsId: "global",
        companyName,
        companyEmail: emailChanged ? oldEmail : companyEmail,
        companyPhone,
        whatsappNumber,
        companyAddress,
        companyDescription,
        companyLogo: uploadedLogoValue || null,
        favicon: uploadedFaviconValue || null,
        workingHours,
        latitude,
        longitude,
        googleMapEmbed,
        socialMedia,
        gstNumber,
        termsAndConditions,
        footerNote,
        trackingWebsiteUrl,
        lastUpdatedBy: req.user?.id || "init",
      });
    } else {
      settings.companyName = companyName;
      if (!emailChanged) {
        settings.companyEmail = companyEmail;
      }
      settings.companyPhone = companyPhone;
      settings.whatsappNumber = whatsappNumber;
      settings.companyAddress = companyAddress;
      settings.companyDescription = companyDescription;
      // Only update if we have a new value to set
      if (uploadedLogoValue !== undefined) {
        settings.companyLogo = uploadedLogoValue;
      }
      if (uploadedFaviconValue !== undefined) {
        settings.favicon = uploadedFaviconValue;
      }
      settings.workingHours = workingHours;
      settings.latitude = latitude;
      settings.longitude = longitude;
      settings.googleMapEmbed = googleMapEmbed;
      settings.socialMedia = socialMedia;
      settings.gstNumber = gstNumber;
      settings.termsAndConditions = termsAndConditions;
      settings.footerNote = footerNote;
      settings.trackingWebsiteUrl = trackingWebsiteUrl;
      settings.lastUpdatedBy = req.user?.id;
      await settings.save();
    }

    if (emailChanged) {
      console.log(`🔄 Email change requested: ${oldEmail} → ${companyEmail}`);

      try {
        const adminUser = await User.findById(req.user.id);

        if (!adminUser) {
          throw new Error("Admin user not found");
        }
        if (adminUser.role !== "admin") {
          throw new Error("User is not an admin");
        }

        const verificationToken =
          Math.random().toString(36).substring(2, 15) +
          Math.random().toString(36).substring(2, 15);

        settings.pendingEmailChange = companyEmail;
        settings.emailVerificationToken = verificationToken;
        settings.emailVerificationExpiry = new Date(
          Date.now() + 24 * 60 * 60 * 1000,
        );
        await settings.save();

        // Send email logic
        const emailConfig = await getEmailConfig();
        const transporter = nodemailer.createTransport(emailConfig);
        const baseUrl = process.env.BETTER_AUTH_URL?.replace("/api/auth", "");
        const verificationUrl = `${baseUrl}/api/settings/verify-email-change?token=${verificationToken}`;

        // Get company logo for email template
        const companyLogoUrl = getUrlFromPublicId(settings.companyLogo, {
          width: 180,
          height: 70,
          crop: "fit",
        });

        const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";

        const emailHtml = generateAdminEmailVerificationHTML(
          companyName,
          verificationUrl,
          companyLogoUrl,
          frontendUrl,
        );

        await transporter.sendMail({
          from: emailConfig.from,
          to: companyEmail,
          subject: "Verify Your New Admin Email Address",
          html: emailHtml,
        });
      } catch (emailError) {
        return res.status(200).json({
          success: true,
          message:
            "General settings updated successfully, but failed to send verification email.",
          data: settings,
          emailChanged,
          warning: `Failed to send verification email: ${emailError.message}`,
        });
      }
    }

    return res.status(200).json({
      success: true,
      message: emailChanged
        ? "General settings updated successfully. Verification email sent to new admin email."
        : "General settings updated successfully",
      data: settings,
      emailChanged,
    });
  } catch (error) {
    console.error("Update general settings error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update general settings",
      error: error.message,
    });
  }
};

/**
 * Verify email change with token - returns HTML response instead of redirect
 */
export const verifyEmailChange = async (req, res) => {
  try {
    const { token } = req.query;
    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";
    const dashboardUrl = `${frontendUrl}/dashboard`;

    if (!token) {
      return res.status(400).send(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Email Verification - Error</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); min-height: 100vh; display: flex; align-items: center; justify-content: center; margin: 0; padding: 20px; }
            .container { background: white; border-radius: 16px; padding: 50px 40px; max-width: 500px; width: 100%; box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3); text-align: center; }
            .icon { font-size: 64px; margin-bottom: 20px; }
            h1 { color: #111827; font-size: 24px; margin: 20px 0 10px 0; }
            p { color: #6b7280; font-size: 16px; line-height: 1.6; margin: 0 0 30px 0; }
            .button { display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 12px 30px; text-decoration: none; border-radius: 8px; font-weight: 600; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="icon">❌</div>
            <h1>Verification Failed</h1>
            <p>Verification token is required. Please check the link in your email and try again.</p>
            <a href="${dashboardUrl}" class="button">Go to Dashboard</a>
          </div>
        </body>
        </html>
      `);
    }

    const settings = await GeneralSettings.findOne({ settingsId: "global" });

    if (!settings) {
      return res.status(404).send(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Email Verification - Error</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); min-height: 100vh; display: flex; align-items: center; justify-content: center; margin: 0; padding: 20px; }
            .container { background: white; border-radius: 16px; padding: 50px 40px; max-width: 500px; width: 100%; box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3); text-align: center; }
            .icon { font-size: 64px; margin-bottom: 20px; }
            h1 { color: #111827; font-size: 24px; margin: 20px 0 10px 0; }
            p { color: #6b7280; font-size: 16px; line-height: 1.6; margin: 0 0 30px 0; }
            .button { display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 12px 30px; text-decoration: none; border-radius: 8px; font-weight: 600; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="icon">❌</div>
            <h1>Settings Not Found</h1>
            <p>Unable to process your request. Please contact your administrator.</p>
            <a href="${dashboardUrl}" class="button">Go to Dashboard</a>
          </div>
        </body>
        </html>
      `);
    }

    // Check if token matches and hasn't expired
    if (
      settings.emailVerificationToken !== token ||
      new Date() > new Date(settings.emailVerificationExpiry)
    ) {
      return res.status(400).send(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Email Verification - Expired</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); min-height: 100vh; display: flex; align-items: center; justify-content: center; margin: 0; padding: 20px; }
            .container { background: white; border-radius: 16px; padding: 50px 40px; max-width: 500px; width: 100%; box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3); text-align: center; }
            .icon { font-size: 64px; margin-bottom: 20px; }
            h1 { color: #111827; font-size: 24px; margin: 20px 0 10px 0; }
            p { color: #6b7280; font-size: 16px; line-height: 1.6; margin: 0 0 30px 0; }
            .button { display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 12px 30px; text-decoration: none; border-radius: 8px; font-weight: 600; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="icon">⏰</div>
            <h1>Link Expired</h1>
            <p>This verification link has expired. Please request a new verification email from the admin panel.</p>
            <a href="${dashboardUrl}" class="button">Go to Dashboard</a>
          </div>
        </body>
        </html>
      `);
    }

    // Apply the email change
    settings.companyEmail = settings.pendingEmailChange;
    settings.emailVerificationToken = null;
    settings.emailVerificationExpiry = null;
    settings.pendingEmailChange = null;

    await settings.save();

    return res.status(200).send(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Email Verified Successfully</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); min-height: 100vh; display: flex; align-items: center; justify-content: center; margin: 0; padding: 20px; }
          .container { background: white; border-radius: 16px; padding: 50px 40px; max-width: 500px; width: 100%; box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3); text-align: center; }
          .icon { font-size: 64px; margin-bottom: 20px; }
          h1 { color: #111827; font-size: 24px; margin: 20px 0 10px 0; }
          .subtitle { color: #0021a0; font-size: 18px; font-weight: 600; margin: 15px 0 20px 0; }
          p { color: #6b7280; font-size: 16px; line-height: 1.6; margin: 15px 0; }
          .email-box { background: #f3f4f6; border-left: 4px solid #0021a0; padding: 16px; border-radius: 8px; margin: 20px 0; }
          .email-label { font-size: 12px; text-transform: uppercase; color: #6b7280; font-weight: 600; letter-spacing: 0.5px; }
          .email-value { font-size: 16px; color: #0021a0; font-weight: 600; font-family: 'Courier New', monospace; margin-top: 5px; }
          .button { display: inline-block; background: linear-gradient(135deg, #0021a0 0%, #0033cc 100%); color: white; padding: 12px 30px; text-decoration: none; border-radius: 8px; font-weight: 600; margin-top: 20px; }
          .info { background: #dbeafe; border-left: 4px solid #0021a0; padding: 16px; border-radius: 8px; margin-top: 20px; text-align: left; font-size: 14px; }
          .info strong { color: #0021a0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="icon">✅</div>
          <h1>Email Verified Successfully!</h1>
          <p>Your admin email has been updated and verified.</p>
          
          <div class="email-box">
            <div class="email-label">New Admin Email</div>
            <div class="email-value">${settings.companyEmail}</div>
          </div>
          
          <div class="info">
            <strong>ℹ️ What's Next?</strong><br>
            Your new admin email is now active. All future admin notifications and communications will be sent to this email address. You can log in to the dashboard to manage your settings.
          </div>
          
          <a href="${dashboardUrl}" class="button">Go to Dashboard</a>
        </div>
      </body>
      </html>
    `);
  } catch (error) {
    console.error("Verify email change error:", error);
    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";
    const dashboardUrl = `${frontendUrl}/dashboard`;

    return res.status(500).send(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Email Verification - Error</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); min-height: 100vh; display: flex; align-items: center; justify-content: center; margin: 0; padding: 20px; }
          .container { background: white; border-radius: 16px; padding: 50px 40px; max-width: 500px; width: 100%; box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3); text-align: center; }
          .icon { font-size: 64px; margin-bottom: 20px; }
          h1 { color: #111827; font-size: 24px; margin: 20px 0 10px 0; }
          p { color: #6b7280; font-size: 16px; line-height: 1.6; margin: 0 0 30px 0; }
          .button { display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 12px 30px; text-decoration: none; border-radius: 8px; font-weight: 600; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="icon">❌</div>
          <h1>Verification Error</h1>
          <p>An error occurred while verifying your email. Please try again or contact support.</p>
          <a href="${dashboardUrl}" class="button">Go to Dashboard</a>
        </div>
      </body>
      </html>
    `);
  }
};

/**
 * Get pricing settings (Delivery and Packing)
 */
export const getPricingSettings = async (req, res) => {
  try {
    let pricingSettings = await PricingSettings.findOne({ settingsId: "global" });

    // Create default settings if they don't exist
    if (!pricingSettings) {
      pricingSettings = await PricingSettings.create({
        settingsId: "global",
        deliveryThresholds: [
          { minAmount: 0, charge: 50 },
          { minAmount: 200, charge: 30 },
          { minAmount: 500, charge: 0 },
        ],
        regionalDeliveryChargeTN: 0,
        regionalDeliveryChargeOutsideTN: 30,
        packingThresholds: [
          { minAmount: 0, charge: 20 },
          { minAmount: 1000, charge: 0 },
        ],
        isDeliveryEnabled: true,
        isPackingEnabled: true,
      });
    }

    return res.status(200).json({
      success: true,
      data: pricingSettings,
    });
  } catch (error) {
    console.error("Get pricing settings error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch pricing settings",
      error: error.message,
    });
  }
};

/**
 * Update pricing settings (Delivery and Packing)
 */
export const updatePricingSettings = async (req, res) => {
  try {
    const {
      deliveryThresholds,
      regionalDeliveryChargeTN,
      regionalDeliveryChargeOutsideTN,
      packingThresholds,
      isDeliveryEnabled,
      isPackingEnabled,
    } = req.body;

    let pricingSettings = await PricingSettings.findOne({ settingsId: "global" });

    if (!pricingSettings) {
      pricingSettings = new PricingSettings({ settingsId: "global" });
    }

    if (deliveryThresholds) pricingSettings.deliveryThresholds = deliveryThresholds;
    if (regionalDeliveryChargeTN !== undefined)
      pricingSettings.regionalDeliveryChargeTN = regionalDeliveryChargeTN;
    if (regionalDeliveryChargeOutsideTN !== undefined)
      pricingSettings.regionalDeliveryChargeOutsideTN = regionalDeliveryChargeOutsideTN;
    if (packingThresholds) pricingSettings.packingThresholds = packingThresholds;
    if (isDeliveryEnabled !== undefined)
      pricingSettings.isDeliveryEnabled = isDeliveryEnabled;
    if (isPackingEnabled !== undefined)
      pricingSettings.isPackingEnabled = isPackingEnabled;

    pricingSettings.lastUpdatedBy = req.user?.id;

    await pricingSettings.save();

    return res.status(200).json({
      success: true,
      message: "Pricing settings updated successfully",
      data: pricingSettings,
    });
  } catch (error) {
    console.error("Update pricing settings error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update pricing settings",
      error: error.message,
    });
  }
};
