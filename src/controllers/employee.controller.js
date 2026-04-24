import User from "../models/User.js";
import { sendEmail } from "../config/sendmail.js";
import crypto from "crypto";
import { getUrlFromPublicId } from "../utils/cloudinary-helper.js";
import { getAuth } from "../lib/auth.js";
import mongoose from "mongoose";

/**
 * Get all employees (admin only)
 */
export const getAllEmployees = async (req, res) => {
  try {
    const { status, page = 1, limit = 20, search } = req.query;

    const query = { role: "employee" };

    if (status === "active") {
      query.banned = false;
    } else if (status === "inactive") {
      query.banned = true;
    }

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
      ];
    }

    const employees = await User.find(query)
      .select("-password")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .lean();

    const total = await User.countDocuments(query);

    res.json({
      success: true,
      employees,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch employees",
      error: error.message,
    });
  }
};

/**
 * Helper function to generate email HTML
 */
const generateEmployeeEmailHTML = (
  name,
  verificationUrl,
  companyName,
  companyLogo,
  frontendUrl,
  isResend = false
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

  const greeting = isResend ? `Hello, ${name}!` : `Welcome, ${name}!`;
  const message = isResend
    ? `Here's a new activation link for your <span class="message-highlight">${companyName}</span> employee account. Click the button below to activate your account and set up your secure password.`
    : `You have been invited to join <span class="message-highlight">${companyName}</span> as a valued team member. To activate your account and set up your secure password, please click the button below.`;

  const securityNote = isResend
    ? `<strong>Security Note:</strong> This activation link will expire in 24 hours. If you did not request this link or have any questions, please contact your administrator.`
    : `<strong>Security Note:</strong> This activation link will expire in 24 hours. If you did not expect this invitation or have any questions, please contact your administrator.`;

  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <meta http-equiv="X-UA-Compatible" content="IE=edge">
      <title>Activate Your Account - ${companyName}</title>
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
                    Professional Printing Solutions
                  </div>
                </td>
              </tr>
              
              <!-- Content -->
              <tr>
                <td style="padding: 50px 40px; background: #ffffff;">
                  <div style="font-size: 22px; font-weight: 700; color: #111827; margin-bottom: 24px; letter-spacing: -0.3px;">
                    ${greeting}
                  </div>
                  <div style="color: #4b5563; font-size: 16px; line-height: 1.8; margin-bottom: 32px;">
                    ${message}
                  </div>
                  
                  <!-- CTA Button -->
                  <div style="text-align: center; margin: 40px 0;">
                    <a href="${verificationUrl}" style="display: inline-block; background: linear-gradient(135deg, #0021a0 0%, #0033cc 100%); color: #ffffff; padding: 16px 40px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px; letter-spacing: 0.5px; box-shadow: 0 4px 15px rgba(0, 33, 160, 0.3);">
                      Activate Your Account
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
                  
                  <div style="color: #6b7280; font-size: 14px; margin-top: 24px; line-height: 1.7;">
                    ${securityNote}
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

/**
 * Create employee account (admin only)
 */
export const createEmployee = async (req, res) => {
  try {
    const { name, email } = req.body;

    if (!name || !email) {
      return res.status(400).json({
        success: false,
        message: "Name and email are required",
      });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: "User with this email already exists",
      });
    }

    // Get company settings for dynamic email content
    const GeneralSettings = (await import("../models/GeneralSettings.js"))
      .default;
    const settings = await GeneralSettings.findOne({ settingsId: "global" });
    const companyName = settings?.companyName || "The Print Emporium";

    // Get company logo URL if available
    const companyLogo = getUrlFromPublicId(settings?.companyLogo, {
      width: 180,
      height: 70,
      crop: "fit",
    });
    // Generate verification token
    const verificationToken = crypto.randomBytes(32).toString("hex");
    const verificationExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    // Create employee user via Better Auth so credentials are properly stored
    const auth = getAuth();
    const tempPassword = crypto.randomBytes(32).toString("hex"); // Temporary password, will be replaced during verification
    try {
      await auth.api.signUpEmail({
        body: {
          name,
          email,
          password: tempPassword,
        },
      });
    } catch (authError) {
      return res.status(400).json({
        success: false,
        message: "User with this email already exists",
      });
    }

    // Update the user with employee role and verification token
    // Use native MongoDB driver to ensure non-schema fields are persisted
    const db = mongoose.connection.db;
    const employee = await db.collection("user").findOneAndUpdate(
      { email },
      {
        $set: {
          role: "employee",
          emailVerified: false,
          banned: false,
          emailVerificationToken: verificationToken,
          emailVerificationExpiry: verificationExpiry,
        },
      },
      { returnDocument: "after" }
    );
    if (!employee) {
      return res.status(500).json({
        success: false,
        message: "Failed to create employee account",
      });
    }

    // Send verification email
    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";
    const verificationUrl = `${frontendUrl}/verify-employee?token=${verificationToken}`;

    const emailHtml = generateEmployeeEmailHTML(
      name,
      verificationUrl,
      companyName,
      companyLogo,
      frontendUrl,
      false
    );

    await sendEmail(
      email,
      `Welcome to ${companyName} - Activate Your Employee Account`,
      emailHtml
    );

    res.status(201).json({
      success: true,
      message: "Employee account created. Verification email sent.",
      employee: {
        id: employee._id,
        name: employee.name,
        email: employee.email,
        role: employee.role,
        emailVerified: employee.emailVerified,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to create employee account",
      error: error.message,
    });
  }
};

/**
 * Verify employee account and set password
 */
export const verifyEmployee = async (req, res) => {
  try {
    const { token, password } = req.body;

    if (!token || !password) {
      return res.status(400).json({
        success: false,
        message: "Token and password are required",
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 6 characters",
      });
    }

    // Find user with valid token using native MongoDB driver
    const db = mongoose.connection.db;
    const employee = await db.collection("user").findOne({
      emailVerificationToken: token,
      emailVerificationExpiry: { $gt: new Date() },
      role: "employee",
    });

    if (!employee) {
      return res.status(400).json({
        success: false,
        message: "Invalid or expired verification token",
      });
    }

    // Set the employee's password in Better Auth's account collection
    const { hashPassword } = await import("better-auth/crypto");
    const hashedPassword = await hashPassword(password);

    // Better Auth stores userId as ObjectId in the account collection
    await db.collection("account").updateOne(
      { userId: employee._id, providerId: "credential" },
      { $set: { password: hashedPassword } }
    );

    // Update employee verification status
    await db.collection("user").updateOne(
      { _id: employee._id },
      {
        $set: { emailVerified: true },
        $unset: { emailVerificationToken: "", emailVerificationExpiry: "" },
      }
    );

    res.json({
      success: true,
      message: "Account verified successfully. You can now log in.",
      employee: {
        id: employee._id,
        name: employee.name,
        email: employee.email,
        role: employee.role,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to verify employee account",
      error: error.message,
    });
  }
};

/**
 * Update employee status (admin only)
 */
export const updateEmployeeStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { banned } = req.body;

    if (typeof banned !== "boolean") {
      return res.status(400).json({
        success: false,
        message: "Banned status must be a boolean",
      });
    }

    const employee = await User.findOne({ _id: id, role: "employee" });

    if (!employee) {
      return res.status(404).json({
        success: false,
        message: "Employee not found",
      });
    }

    employee.banned = banned;
    await employee.save();

    res.json({
      success: true,
      message: `Employee ${banned ? "deactivated" : "activated"} successfully`,
      employee: {
        id: employee._id,
        name: employee.name,
        email: employee.email,
        banned: employee.banned,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to update employee status",
      error: error.message,
    });
  }
};

/**
 * Delete employee (admin only)
 */
export const deleteEmployee = async (req, res) => {
  try {
    const { id } = req.params;

    const employee = await User.findOne({ _id: id, role: "employee" });

    if (!employee) {
      return res.status(404).json({
        success: false,
        message: "Employee not found",
      });
    }

    // Delete employee's account records from Better Auth and user collection
    const db = mongoose.connection.db;
    await db.collection("account").deleteMany({ userId: employee._id });
    await db.collection("session").deleteMany({ userId: employee._id });
    await User.deleteOne({ _id: id });

    res.json({
      success: true,
      message: "Employee deleted successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to delete employee",
      error: error.message,
    });
  }
};

/**
 * Resend verification email (admin only)
 */
export const resendVerification = async (req, res) => {
  try {
    const { id } = req.params;

    const employee = await User.findOne({ _id: id, role: "employee" });

    if (!employee) {
      return res.status(404).json({
        success: false,
        message: "Employee not found",
      });
    }

    if (employee.emailVerified) {
      return res.status(400).json({
        success: false,
        message: "Employee account is already verified",
      });
    }

    // Get company settings for dynamic email content
    const GeneralSettings = (await import("../models/GeneralSettings.js"))
      .default;
    const settings = await GeneralSettings.findOne({ settingsId: "global" });
    const companyName = settings?.companyName || "The Print Emporium";

    // Get company logo URL if available
    const companyLogo = getUrlFromPublicId(settings?.companyLogo, {
      width: 180,
      height: 70,
      crop: "fit",
    });

    // Generate new verification token
    const verificationToken = crypto.randomBytes(32).toString("hex");
    const verificationExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const db = mongoose.connection.db;
    await db.collection("user").updateOne(
      { _id: employee._id },
      {
        $set: {
          emailVerificationToken: verificationToken,
          emailVerificationExpiry: verificationExpiry,
        },
      }
    );

    // Send verification email
    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";
    const verificationUrl = `${frontendUrl}/verify-employee?token=${verificationToken}`;

    const emailHtml = generateEmployeeEmailHTML(
      employee.name,
      verificationUrl,
      companyName,
      companyLogo,
      frontendUrl,
      true
    );

    await sendEmail(
      employee.email,
      `Activate Your ${companyName} Account`,
      emailHtml
    );

    res.json({
      success: true,
      message: "Verification email sent successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to resend verification email",
      error: error.message,
    });
  }
};
