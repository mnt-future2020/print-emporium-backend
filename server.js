import "./src/config/env.js"; // Load env vars BEFORE any other imports
import express from "express"; // Force restart
import cors from "cors";
import cookieParser from "cookie-parser";
import { toNodeHandler, fromNodeHeaders } from "better-auth/node";

import { initAuth } from "./src/lib/auth.js";
import { connectDB } from "./src/config/database.js";
import authRoutes from "./src/routes/auth.routes.js";
import settingsRoutes, {
  publicRouter as paymentPublicRouter,
  userRouter as paymentUserRouter,
} from "./src/routes/settings.routes.js";
import seoRoutes from "./src/routes/seo.routes.js";
import serviceRoutes from "./src/routes/service.routes.js";
import serviceOptionRoutes from "./src/routes/serviceOption.routes.js";
import heroSlideRoutes from "./src/routes/hero-slide.routes.js";
import fileConversionRoutes from "./src/routes/fileConversion.routes.js";
import orderRoutes from "./src/routes/order.routes.js";
import employeeRoutes from "./src/routes/employee.routes.js";
import customerRoutes from "./src/routes/customer.routes.js";
import leadRoutes from "./src/routes/lead.routes.js";
import couponRoutes from "./src/routes/coupon.routes.js";
import pdfRoutes from "./src/routes/pdf.routes.js";
import pincodeRoutes from "./src/routes/pincode.routes.js";
import { requireAdminOrSignedRequest } from "./src/middleware/signature.middleware.js";
import { seedAdmin } from "./src/utils/seedAdmin.js";
// import { seedOrders } from "./src/utils/seedOrders.js";

const app = express();
app.set("trust proxy", 1); // Enable trust proxy for secure cookies behind load balancers
const PORT = process.env.PORT || 5000;

// Middleware - CORS must be configured before all routes
const corsOrigins = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(",").map((o) => o.trim())
  : [];

const allowedOrigins = [
  ...corsOrigins,
  "http://localhost:3000",
  "http://localhost:5173",
].filter(Boolean);

app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "Cookie",
      "X-Requested-With",
      "x-signature",
      "x-timestamp",
      "Cache-Control",
      "Pragma",
      "Expires",
    ],
    exposedHeaders: ["Set-Cookie"], // Important for cross-origin cookie handling
  }),
);

// Request logging middleware
app.use((req, res, next) => {
  const start = Date.now();

  // Log when response finishes
  res.on("finish", () => {
    const duration = Date.now() - start;
    const statusColor =
      res.statusCode >= 500 ? "🔴" : res.statusCode >= 400 ? "🟡" : "🟢";
    const path = req.originalUrl || req.url;
    console.log(
      `${statusColor} ${res.statusCode} ${req.method} ${path} - ${duration}ms`,
    );
  });

  next();
});

app.use(cookieParser());

app.get("/", (req, res) => {
  res.send("PrintEmporium Backend is running");
});

// Handle unexpected POST to root (likely from browser extensions or tools)
app.post("/", (req, res) => {
  res.status(200).json({ message: "PrintEmporium API - Use /api/* endpoints" });
});

// Start server
const startServer = async () => {
  // 1. Immediately start listening to prevent 503 timeouts on Cloud Hosting
  // Explicitly binding to 0.0.0.0 prevents IPv4/IPv6 loopback mismatch with Hostinger's reverse proxy
  const server = app.listen(PORT, "0.0.0.0", () => {
    console.log(`\n🚀 Server running on port ${PORT}`);
    console.log(`📍 API: http://localhost:${PORT}`);
    console.log(`🔐 Auth: http://localhost:${PORT}/api/auth`);
    console.log(`\n✨ Ready to accept requests!\n`);
  });

  try {
    // 2. Connect to database
    await connectDB();

    // 3. Initialize Better Auth after database connection
    const auth = initAuth();
    console.log("✅ Better Auth initialized");

    // 4. Seed admin user
    await seedAdmin();

    // Better Auth API Handler (MUST be before express.json())
    app.use("/api/auth", toNodeHandler(auth));

    // Mount express json middleware AFTER Better Auth handler
    app.use(express.json({ limit: "10mb" }));
    app.use(express.urlencoded({ limit: "10mb", extended: true }));

    // Custom Routes
    app.use("/api/auth", authRoutes); // Auth handled separately
    app.use("/api/settings", requireAdminOrSignedRequest, settingsRoutes);
    app.use("/api", paymentPublicRouter); // /webhook/razorpay
    app.use("/api", paymentUserRouter); // /create-order-razorpay
    app.use("/api/seo", requireAdminOrSignedRequest, seoRoutes);
    app.use("/api/services", requireAdminOrSignedRequest, serviceRoutes);
    app.use(
      "/api/service-options",
      requireAdminOrSignedRequest,
      serviceOptionRoutes,
    );
    app.use("/api/hero-slides", requireAdminOrSignedRequest, heroSlideRoutes);
    app.use("/api/file-conversion", fileConversionRoutes); // Public endpoint for file conversion
    app.use("/api/orders", orderRoutes); // Order management routes
    app.use("/api/employees", employeeRoutes); // Employee management routes
    app.use("/api/customers", requireAdminOrSignedRequest, customerRoutes); // Customer management routes
    app.use("/api/leads", leadRoutes); // CRM Lead routes
    app.use("/api/coupons", couponRoutes); // Coupon management routes
    app.use("/api/pdf", requireAdminOrSignedRequest, pdfRoutes); // PDF generation routes
    app.use("/api/pincode", pincodeRoutes); // Public pincode lookup (cached proxy)

    // Example of getting session in a custom route
    app.get("/api/me", async (req, res) => {
      try {
        const session = await auth.api.getSession({
          headers: fromNodeHeaders(req.headers),
        });

        if (!session) {
          return res.status(401).json({ error: "Not authenticated" });
        }

        return res.json(session);
      } catch (error) {
        console.error("Session error:", error);
        return res.status(500).json({ error: "Internal server error" });
      }
    });
  } catch (error) {
    console.error(
      "❌ Failed to initialize core services (DB/Auth/Seed):",
      error.message,
    );
    console.warn(
      "⚠️ Server is running but some features may not work until the error is resolved.",
    );
    // DO NOT add process.exit(1) here as it will kill the process and cause 503 errors.
  }
};

startServer();
