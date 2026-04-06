import nodemailer from "nodemailer";
import EmailConfiguration from "../models/EmailConfiguration.js";
import { getEmailConfig } from "../config/sendmail.js";
import {
  encryptPassword,
  decryptPassword,
} from "../utils/encryption.js";

// Get email configuration
export const getEmailConfiguration = async (req, res) => {
  try {
    const config = await EmailConfiguration.findOne();

    if (config && config.smtpPassword) {
      config.smtpPassword = "********"; 
    }

    return res.json({
      success: true,
      emailConfig: config || {},
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Update email configuration
export const updateEmailConfiguration = async (req, res) => {
  try {
    const body = req.body;
    const requiredFields = ["smtpPort", "smtpUsername", "smtpPassword", "senderEmail", "smtpHost"];
    
    for (const field of requiredFields) {
      if (!body[field]) {
        return res.status(400).json({
          success: false,
          message: `${field} is required`,
        });
      }
    }

    let passwordToSave = body.smtpPassword;
    if (passwordToSave !== "********") {
      passwordToSave = encryptPassword(body.smtpPassword);
    } else {
      const existingConfig = await EmailConfiguration.findOne();
      if (existingConfig) {
        passwordToSave = existingConfig.smtpPassword;
      }
    }

    const config = await EmailConfiguration.findOneAndUpdate(
      {},
      {
        ...body,
        smtpPassword: passwordToSave,
        updatedAt: new Date(),
      },
      { upsert: true, new: true }
    );

    config.smtpPassword = "********";

    return res.json({
      success: true,
      emailConfig: config,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const testEmailConfiguration = async (req, res) => {
  try {
    const { testEmail, message } = req.body;

    if (!testEmail || !testEmail.includes("@")) {
      return res.status(400).json({
        success: false,
        message: "Please provide a valid test email address",
      });
    }

    const emailConfig = await getEmailConfig();

    try {
      const transporter = nodemailer.createTransport(emailConfig);

      if (emailConfig.host.includes("gmail")) {
        try {
          await transporter.verify();
        } catch (gmailError) {
          return res.status(401).json({
            success: false,
            message: "Gmail authentication failed.",
            details: gmailError.message,
          });
        }
      }

      await transporter.sendMail({
        from: emailConfig.from,
        to: testEmail,
        subject: "Test Email Configuration",
        text: message || "This is a test email.",
      });

      return res.json({
        success: true,
        message: "Test email sent successfully",
        configSource: emailConfig.host === process.env.SMTP_HOST ? "Environment Variables" : "Database Settings",
      });
    } catch (emailError) {
      return res.status(500).json({
        success: false,
        message: "Failed to send test email",
        details: emailError.message,
      });
    }
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
