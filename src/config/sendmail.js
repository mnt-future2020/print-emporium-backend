import nodemailer from "nodemailer";
import EmailConfiguration from "../models/EmailConfiguration.js";
import { decryptPassword } from "../utils/encryption.js";

// Get email configuration with fallback to environment variables
export async function getEmailConfig() {
  try {
    // First, try to get configuration from database
    const dbConfig = await EmailConfiguration.findOne();

    if (
      dbConfig &&
      dbConfig.smtpHost &&
      dbConfig.smtpUsername &&
      dbConfig.smtpPassword
    ) {
      // Decrypt password if it's encrypted
      const decryptedPassword = decryptPassword(dbConfig.smtpPassword);
      
      return {
        host: dbConfig.smtpHost,
        port: parseInt(dbConfig.smtpPort) || 587,
        auth: {
          user: dbConfig.smtpUsername,
          pass: decryptedPassword,
        },
        from: dbConfig.senderEmail,
        secure: parseInt(dbConfig.smtpPort) === 465,
        tls: {
          rejectUnauthorized: false,
          ciphers: "SSLv3",
        },
        debug: false,
        logger: false,
      };
    } else {
      // Fallback to environment variables
      return {
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT) || 587,
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
        from: process.env.SMTP_FROM_EMAIL,
        secure: Number(process.env.SMTP_PORT) === 465,
        tls: {
          rejectUnauthorized: false,
          ciphers: "SSLv3",
        },
        debug: false,
        logger: false,
      };
    }
  } catch (error) {
    // Final fallback to environment variables
    return {
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
      from: process.env.SMTP_FROM_EMAIL,
      secure: Number(process.env.SMTP_PORT) === 465,
      tls: {
        rejectUnauthorized: false,
        ciphers: "SSLv3",
      },
      debug: false,
      logger: false,
    };
  }
}

export async function sendEmail(userEmail, subject, message) {
  try {
    // Get dynamic email configuration
    const emailConfig = await getEmailConfig();

    // Validate required configuration
    if (!emailConfig.host || !emailConfig.auth.user || !emailConfig.auth.pass) {
      throw new Error(
        "Email configuration is incomplete. Please check SMTP settings."
      );
    }

    const transporter = nodemailer.createTransport(emailConfig);

    const mailOptions = {
      from: emailConfig.from,
      to: userEmail,
      subject,
      html: message,
    };

    await transporter.sendMail(mailOptions);
  } catch (error) {
    throw error;
  }
}
