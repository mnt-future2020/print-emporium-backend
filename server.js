import express from "express";
import cors from "cors";
import dotenv from "dotenv";
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
import { requireAdminOrSignedRequest } from "./src/middleware/signature.middleware.js";
import { seedAdmin } from "./src/utils/seedAdmin.js";

dotenv.config();

const app = express();
app.set("trust proxy", 1);

const PORT = process.env.PORT || 5000;

// ✅ CORS
const allowedOrigins = [
  process.env.FRONTEND_URL,
  "http://localhost:3000",
  "http://localhost:5173",
  "https://print-emporium.vercel.app",
  "https://theprintemporium.in",
].filter(Boolean);

app.use(
  cors({
    origin: allowedOrigins.length ? allowedOrigins : "*",
    credentials: true,
  })
);

// ✅ LOGGING
app.use((req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
    const duration = Date.now() - start;
    console.log(`${res.statusCode} ${req.method} ${req.originalUrl} - ${duration}ms`);
  });
  next();
});

app.use(cookieParser());

// ✅ BASIC ROUTES (ALWAYS AVAILABLE)
app.get("/", (req, res) => {
  res.send("PrintEmporium Backend is running");
});

app.post("/", (req, res) => {
  res.json({ message: "Use /api endpoints" });
});

// ✅ BODY PARSER
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// 🚀 START SERVER IMMEDIATELY (Fix 504)
app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Server running on port ${PORT}`);
});

// 🚀 BACKGROUND INITIALIZATION
let authInstance = null;

(async () => {
  try {
    console.log("🔄 Connecting to DB...");
    await connectDB();
    console.log("✅ Database connected");

    console.log("🔄 Initializing Auth...");
    authInstance = initAuth();
    console.log("✅ Auth initialized");

    console.log("🔄 Seeding Admin...");
    await seedAdmin();
    console.log("✅ Admin ready");

    // ✅ Auth handler
    app.use("/api/auth", toNodeHandler(authInstance));

  } catch (err) {
    console.error("❌ Background init error:", err);
  }
})();

// ✅ ROUTES (SAFE TO LOAD IMMEDIATELY)
app.use("/api/auth", authRoutes);
app.use("/api/settings", requireAdminOrSignedRequest, settingsRoutes);
app.use("/api", paymentPublicRouter);
app.use("/api", paymentUserRouter);
app.use("/api/seo", requireAdminOrSignedRequest, seoRoutes);
app.use("/api/services", requireAdminOrSignedRequest, serviceRoutes);
app.use("/api/service-options", requireAdminOrSignedRequest, serviceOptionRoutes);
app.use("/api/hero-slides", requireAdminOrSignedRequest, heroSlideRoutes);
app.use("/api/file-conversion", fileConversionRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/employees", employeeRoutes);
app.use("/api/customers", requireAdminOrSignedRequest, customerRoutes);
app.use("/api/leads", leadRoutes);
app.use("/api/coupons", couponRoutes);
app.use("/api/pdf", requireAdminOrSignedRequest, pdfRoutes);

// ✅ SESSION ROUTE (SAFE CHECK)
app.get("/api/me", async (req, res) => {
  try {
    if (!authInstance) {
      return res.status(503).json({ error: "Auth not ready" });
    }

    const session = await authInstance.api.getSession({
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
