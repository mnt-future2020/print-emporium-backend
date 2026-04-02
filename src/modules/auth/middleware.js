import { fromNodeHeaders } from "better-auth/node";
import { hasPermission } from "./permissions.js";

/**
 * Higher-order middleware to create authorization checks.
 */
export const createAuthMiddleware = (auth) => {
  /**
   * Basic authentication middleware.
   */
  const requireAuth = async (req, res, next) => {
    try {
      const session = await auth.api.getSession({
        headers: fromNodeHeaders(req.headers),
      });

      if (!session) {
        return res.status(401).json({ error: "Unauthorized: No active session" });
      }

      req.session = session;
      req.user = session.user;
      next();
    } catch (error) {
      console.error("Auth middleware error:", error);
      res.status(500).json({ error: "Internal server error during authentication" });
    }
  };

  /**
   * Role-based access control middleware.
   */
  const requireRole = (role) => {
    return [
      requireAuth,
      (req, res, next) => {
        if (req.user.role !== role && req.user.role !== "admin") {
          return res.status(403).json({ error: `Forbidden: Requires ${role} role` });
        }
        next();
      },
    ];
  };

  /**
   * Permission-based access control middleware.
   */
  const requirePermission = (permission) => {
    return [
      requireAuth,
      (req, res, next) => {
        if (!hasPermission(req.user.role, permission)) {
          return res.status(403).json({ error: `Forbidden: Lacks permission ${permission}` });
        }
        next();
      },
    ];
  };

  return {
    requireAuth,
    requireRole,
    requirePermission,
    getSession: async (headers) => auth.api.getSession({ headers: fromNodeHeaders(headers) }),
  };
};
