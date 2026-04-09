import crypto from "crypto";
import { fromNodeHeaders } from "better-auth/node";
import { initAuth } from "../lib/auth.js";

/**
 * Middleware to verify HMAC signatures for public API requests OR
 * verify admin session for dashboard requests.
 */
/**
 * Middleware to verify HMAC signatures for public API requests OR
 * verify admin session for dashboard requests.
 *
 * Works universally for all routes.
 */
export const requireAdminOrSignedRequest = async (req, res, next) => {
  try {
    // 1. Check for Admin Session first (Dashboard/Internal access)
    const auth = initAuth();
    const session = await auth.api.getSession({
      headers: fromNodeHeaders(req.headers),
    });

    // Debug logging for production troubleshooting
    if (process.env.NODE_ENV === "production") {
      console.log(`🔐 Auth check: ${req.method} ${req.path}`, {
        hasSession: !!session,
        userRole: session?.user?.role,
        origin: req.headers.origin,
        hasCookies: !!req.headers.cookie,
      });
    }

    if (session && session.user.role === "admin") {
      return next();
    }

    // 2. Allow requests from official Frontend (GET only)
    // This allows client-side hooks like useCompanySettings to work
    const origin = req.headers.origin;
    const referer = req.headers.referer;
    const allowedOrigins = process.env.CORS_ORIGINS
      ? process.env.CORS_ORIGINS.split(",").map((o) => o.trim())
      : [process.env.FRONTEND_URL || "http://localhost:3000"];

    const isFromFrontend =
      (origin &&
        allowedOrigins.some(
          (o) => origin === o || origin.startsWith(o.replace(/\/$/, "")),
        )) ||
      (referer && allowedOrigins.some((o) => referer.startsWith(o)));

    if (req.method === "GET" && isFromFrontend) {
      return next();
    }

    // 3. Check for HMAC Signature (Public server-to-server or non-browser access)
    const signature = req.headers["x-signature"];
    const timestamp = req.headers["x-timestamp"];
    const secret =
      process.env.API_SHARED_SECRET || "default_api_secret_change_me";

    if (!signature || !timestamp) {
      console.log(
        `⚠️ Auth failed: No session or signature for ${req.method} ${req.path}`,
      );
      return res.status(401).json({
        success: false,
        message: "Unauthorized: Protected API",
      });
    }

    // Protection: Prevent Replay Attacks within a 5-minute window
    const now = Date.now();
    const requestTime = parseInt(timestamp, 10);
    const fiveMinutes = 5 * 60 * 1000;

    if (isNaN(requestTime) || Math.abs(now - requestTime) > fiveMinutes) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized: Signature expired",
      });
    }

    // Re-calculate the expected signature
    const rawPath = (req.baseUrl + req.path).toLowerCase();
    const path =
      rawPath.endsWith("/") && rawPath.length > 1
        ? rawPath.slice(0, -1)
        : rawPath;
    const method = req.method.toUpperCase();
    const payload = `${method}:${path}:${timestamp}`;

    const expectedSignature = crypto
      .createHmac("sha256", secret)
      .update(payload)
      .digest("hex");

    if (signature === expectedSignature) {
      return next();
    }

    return res.status(401).json({
      success: false,
      message: "Unauthorized: Invalid API signature",
    });
  } catch (error) {
    console.error("Universal signature verification error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal authorization error",
    });
  }
};
