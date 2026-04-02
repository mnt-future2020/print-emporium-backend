import { betterAuth } from "better-auth";
import { mongodbAdapter } from "better-auth/adapters/mongodb";
import { admin } from "better-auth/plugins";

/**
 * Creates a Better Auth instance with modular configuration.
 * @param {Object} options - Configuration options
 * @param {Object} options.db - MongoDB database instance
 * @param {Object} options.email - Email configuration/handlers
 * @param {Object} options.google - Google Social provider config
 * @param {Object} options.env - Environment variables
 * @param {Array} options.trustedOrigins - Trusted origins for CORS
 */
export const createAuthInstance = ({
  db,
  emailHandlers,
  google,
  env,
  trustedOrigins = [],
}) => {
  return betterAuth({
    database: mongodbAdapter(db),

    session: {
      expiresIn: 60 * 60 * 24 * 7, // 7 days
      updateAge: 60 * 60 * 24, // Once per day
      cookieCache: {
        enabled: true,
        maxAge: 5 * 60,
      },
    },

    advanced: {
      useSecureCookies: env.NODE_ENV === "production" || env.VERCEL === "1",
      defaultCookieAttributes: {
        httpOnly: true,
        secure: env.NODE_ENV === "production" || env.VERCEL === "1",
        sameSite: env.NODE_ENV === "production" || env.VERCEL === "1" ? "none" : "lax",
        path: "/",
      },
    },

    socialProviders: {
      google: {
        clientId: google.clientId,
        clientSecret: google.clientSecret,
        prompt: "select_account",
        accessType: "offline",
      },
    },

    emailAndPassword: {
      enabled: true,
      minPasswordLength: 6,
      maxPasswordLength: 128,
      resetPasswordTokenExpiresIn: 3600,
      sendResetPassword: emailHandlers.sendResetPassword,
    },

    plugins: [
      admin({
        adminUserIds: [],
      }),
    ],

    emailVerification: {
      sendVerificationEmail: emailHandlers.sendVerificationEmail,
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

    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.BETTER_AUTH_URL?.endsWith("/api/auth") 
      ? env.BETTER_AUTH_URL 
      : `${env.BETTER_AUTH_URL}/api/auth`,

    trustedOrigins: trustedOrigins.filter(Boolean),

    redirects: {
      resetPassword: env.FRONTEND_URL || "http://localhost:3000",
    },
  });
};
