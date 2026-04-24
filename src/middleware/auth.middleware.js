import { fromNodeHeaders } from "better-auth/node";
import { initAuth } from "../lib/auth.js";

/**
 * Middleware to check if the user is authenticated.
 * Uses the better-auth session.
 * IMPORTANT: fromNodeHeaders converts Express headers to Web Headers for Better Auth
 */
export const requireAuth = async (req, res, next) => {
  try {
    const auth = initAuth();
    const session = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) });

    if (!session || !session.user) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized: Authentication required"
      });
    }

    req.user = session.user;
    next();
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Internal server error during authorization"
    });
  }
};

/**
 * Middleware to check if the user is authenticated and has the admin role.
 * Uses the better-auth session.
 */
export const requireAdmin = async (req, res, next) => {
  try {
    const auth = initAuth();
    const session = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) });

    if (!session || !session.user || session.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Unauthorized: Admin access required"
      });
    }

    req.user = session.user;
    next();
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Internal server error during authorization"
    });
  }
};

/**
 * Middleware to check if the user is authenticated and has admin or employee role.
 * Uses the better-auth session.
 */
export const requireAdminOrEmployee = async (req, res, next) => {
  try {
    const auth = initAuth();
    const session = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) });

    if (!session || !session.user || !['admin', 'employee'].includes(session.user.role)) {
      return res.status(403).json({
        success: false,
        message: "Unauthorized: Admin or Employee access required"
      });
    }

    req.user = session.user;
    next();
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Internal server error during authorization"
    });
  }
};
