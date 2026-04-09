import { betterAuth } from "better-auth";
import { mongodbAdapter } from "better-auth/adapters/mongodb";
import { admin } from "better-auth/plugins";
import mongoose from "mongoose";
import { sendEmail } from "../config/sendmail.js";
import { getUrlFromPublicId } from "../utils/cloudinary-helper.js";

let authInstance = null;

export const initAuth = () => {
  if (authInstance) return authInstance;

  authInstance = betterAuth({
    database: mongodbAdapter(
      mongoose.connection.getClient().db("printemporium"),
    ),

    session: {
      expiresIn: 60 * 60 * 24 * 7, // 7 days
      updateAge: 60 * 60 * 24, // Only update session once per day (reduces DB writes)
      cookieCache: {
        enabled: true,
        maxAge: 5 * 60, // Cache for 5 minutes
      },
    },

    // Advanced configuration for production cookie handling
    // Using the recommended 'advanced' pattern from Better Auth docs
    advanced: {
      // Force secure cookies in production OR Vercel environment
      useSecureCookies:
        process.env.NODE_ENV === "production" || process.env.VERCEL === "1",
      // Default attributes for all cookies
      defaultCookieAttributes: {
        httpOnly: true,
        // vital for Vercel/Render deployments behind load balancers
        secure:
          process.env.NODE_ENV === "production" || process.env.VERCEL === "1",
        // For cross-domain (frontend on domain A, backend on domain B),
        // sameSite MUST be "none" in production with secure: true
        sameSite:
          process.env.NODE_ENV === "production" || process.env.VERCEL === "1"
            ? "none"
            : "lax",
        path: "/",
      },
    },

    socialProviders: {
      google: {
        clientId: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        // Better Auth handles the redirect URI automatically based on baseURL.
        // It will be: ${baseURL}/callback/google
        // Based on your Google Console, this should resolve to:
        // http://localhost:5000/api/auth/callback/google

        // Optional: Always ask user to select account
        prompt: "select_account",
        accessType: "offline",
      },
    },

    emailAndPassword: {
      enabled: true,
      minPasswordLength: 6,
      maxPasswordLength: 128,
      resetPasswordTokenExpiresIn: 3600, // 1 hour
      sendResetPassword: async ({ user, url, token }, request) => {
        console.log(`📧 Password reset requested for: ${user.email}`);

        try {
          // Get company settings
          const settings = await mongoose.connection.db
            .collection("generalsettings")
            .findOne({ settingsId: "global" });
          const companyName = settings?.companyName || "The Print Emporium";

          console.log(
            "📧 Password reset - Raw company logo from DB:",
            settings?.companyLogo,
          );

          // Get company logo URL using centralized helper function
          const companyLogo = getUrlFromPublicId(settings?.companyLogo, {
            width: 180,
            height: 70,
            crop: "fit",
          });

          console.log("📧 Password reset - Final logo URL:", companyLogo);

          // Create frontend reset URL instead of using the backend URL
          const frontendUrl =
            process.env.FRONTEND_URL || "http://localhost:3000";
          const resetUrl = `${frontendUrl}/reset-password?token=${token}`;

          // Logo HTML with better fallback
          let logoHtml = "";
          if (companyLogo) {
            logoHtml = `
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                <tr>
                  <td align="center" style="padding-bottom: 16px;">
                    <img 
                      src="${companyLogo}" 
                      alt="${companyName}" 
                      width="180"
                      height="70"
                      style="display: block; max-width: 180px; height: auto; border: 0; outline: none; text-decoration: none; -ms-interpolation-mode: bicubic;"
                    />
                  </td>
                </tr>
              </table>
            `;
          } else {
            logoHtml = `
              <div style="color: white; font-size: 28px; font-weight: 700; letter-spacing: -0.5px; margin-bottom: 12px;">
                ${companyName}
              </div>
            `;
          }

          const emailHtml = `
          <!DOCTYPE html>
          <html lang="en">
          <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <meta http-equiv="X-UA-Compatible" content="IE=edge">
            <title>Reset Your Password - ${companyName}</title>
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
                  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="680" style="max-width: 680px; background: #ffffff; border-radius: 16px; box-shadow: 0 10px 25px rgba(0, 0, 0, 0.08);">
                    
                    <!-- Header -->
                    <tr>
                      <td style="background: linear-gradient(135deg, #0021a0 0%, #0033cc 100%); padding: 50px 40px; text-align: center; border-radius: 16px 16px 0 0;">
                        ${logoHtml}
                        <div style="color: rgba(255, 255, 255, 0.85); font-size: 14px; letter-spacing: 1px; text-transform: uppercase;">
                          Account Security
                        </div>
                      </td>
                    </tr>
                    
                    <!-- Content -->
                    <tr>
                      <td style="padding: 50px 40px; background: #ffffff;">
                        <div style="font-size: 22px; font-weight: 700; color: #111827; margin-bottom: 24px; letter-spacing: -0.3px;">
                          Reset Your Password
                        </div>
                        <div style="color: #4b5563; font-size: 16px; line-height: 1.8; margin-bottom: 32px;">
                          Hello ${user.name || "Administrator"},<br><br>
                          We received a request to reset the password for your ${companyName} account. Click the button below to create a new password securely.
                        </div>
                        
                        <!-- CTA Button -->
                        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                          <tr>
                            <td align="center" style="padding: 40px 0;">
                              <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                                <tr>
                                  <td style="background: linear-gradient(135deg, #0021a0 0%, #0033cc 100%); border-radius: 8px;">
                                    <a href="${resetUrl}" target="_blank" style="display: inline-block; color: #ffffff; padding: 16px 40px; text-decoration: none; font-weight: 600; font-size: 16px; letter-spacing: 0.5px;">
                                      Reset Password
                                    </a>
                                  </td>
                                </tr>
                              </table>
                            </td>
                          </tr>
                        </table>
                        
                        <!-- Link Section -->
                        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin-top: 32px;">
                          <tr>
                            <td style="padding: 24px; background: #f8fafc; border-radius: 8px; border-left: 4px solid #0021a0;">
                              <div style="color: #6b7280; font-size: 13px; font-weight: 600; text-transform: uppercase; margin-bottom: 12px; letter-spacing: 0.5px;">
                                Or copy this link:
                              </div>
                              <div style="word-break: break-all; color: #0021a0; font-size: 14px; font-family: 'Courier New', monospace; line-height: 1.6;">
                                ${resetUrl}
                              </div>
                            </td>
                          </tr>
                        </table>
                        
                        <!-- Warning Box -->
                        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin-top: 24px;">
                          <tr>
                            <td style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 16px 20px; border-radius: 6px;">
                              <div style="color: #92400e; font-size: 14px; line-height: 1.6;">
                                <strong>Important:</strong> This reset link will expire in 1 hour. If you didn't request a password reset, please ignore this email. Your account remains secure.
                              </div>
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                    
                    <!-- Footer -->
                    <tr>
                      <td style="background: #f3f4f6; padding: 30px 40px; text-align: center; border-top: 1px solid #e5e7eb; border-radius: 0 0 16px 16px;">
                        <div style="color: #6b7280; font-size: 13px; line-height: 1.6;">
                          © ${new Date().getFullYear()} ${companyName}. All rights reserved.<br>
                          Never share your password with anyone. We will never ask for your password via email.<br>
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

          await sendEmail(
            user.email,
            `🔐 Reset Your Password - ${companyName}`,
            emailHtml,
          );
          console.log(`✅ Password reset email sent to: ${user.email}`);
        } catch (error) {
          console.error(`❌ Failed to send reset email:`, error);
        }
      },
    },

    plugins: [
      admin({
        adminUserIds: [],
      }),
    ],

    emailVerification: {
      sendVerificationEmail: async ({ user, url, token }) => {
        console.log(`📧 Sending verification email to: ${user.email}`);
        // Email sending will be handled by the settings controller for email changes
      },
      autoSignInAfterVerification: true,
    },

    user: {
      changeEmail: {
        enabled: true,
        updateEmailWithoutVerification: false,
      },
      additionalFields: {
        isActive: {
          type: "boolean",
          required: false,
          defaultValue: true,
        },
      },
    },

    secret: process.env.BETTER_AUTH_SECRET,
    baseURL: process.env.BETTER_AUTH_URL?.endsWith("/api/auth")
      ? process.env.BETTER_AUTH_URL
      : `${process.env.BETTER_AUTH_URL}/api/auth`,

    trustedOrigins: [
      ...(process.env.CORS_ORIGINS
        ? process.env.CORS_ORIGINS.split(",").map((o) => o.trim())
        : []),
      "http://localhost:3000",
      "http://localhost:5173",
      "http://localhost:5000",
    ].filter(Boolean),

    // Configure redirect URLs for password reset
    redirects: {
      resetPassword: process.env.FRONTEND_URL || "http://localhost:3000",
    },
  });

  return authInstance;
};

export const getAuth = () => {
  if (!authInstance) {
    throw new Error("Auth not initialized. Call initAuth() first.");
  }
  return authInstance;
};
