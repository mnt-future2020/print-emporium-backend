import express from "express";
import {
  getSettings,
  updateGeneralSettings,
  verifyEmailChange,
  getPricingSettings,
  updatePricingSettings,
} from "../controllers/settings.controller.js";
import {
  getEmailConfiguration,
  updateEmailConfiguration,
  testEmailConfiguration,
} from "../controllers/email.controller.js";
import {
  getPaymentSettings,
  updatePaymentSettings,
} from "../controllers/payment.controller.js";
import { requireAdmin } from "../middleware/auth.middleware.js";

const router = express.Router();

// Fetching routes (Global Signature/Session protection applied in server.js)
router.get("/", getSettings);
router.get("/verify-email-change", verifyEmailChange);

// Protected admin routes (Mutation operations)
router.put("/general", requireAdmin, updateGeneralSettings);
router.get("/email-configuration", requireAdmin, getEmailConfiguration);
router.put("/email-configuration", requireAdmin, updateEmailConfiguration);
router.post("/email-configuration/test", requireAdmin, testEmailConfiguration);

// Razorpay settings routes
router.get("/payment-gateway", requireAdmin, getPaymentSettings);
router.put("/payment-gateway", requireAdmin, updatePaymentSettings);

// Pricing settings routes (Delivery and Packing)
router.get("/pricing", getPricingSettings);
router.put("/pricing", requireAdmin, updatePricingSettings);

// Public Order Routes (Should normally be in order.routes? But for now keeping here or move to a new file?
// Actually, creating a payment ORDER is usually initiated by the user during checkout.
// The payment controller has the logic. We should probably expose it via a public route or user authenticated route.
// But the task plan said "settings.routes.js" - let's stick to plan but query where it makes sense.
// Actually, creating a payment order is for the checkout flow, so it should be accessible by authenticated users, not just admins.
// AND webhook is public.
import {
  createPaymentOrder,
  handlePaymentWebhook,
  verifyPayment,
} from "../controllers/payment.controller.js";
import { requireAuth } from "../middleware/auth.middleware.js"; // Standard user auth

const publicRouter = express.Router();
publicRouter.post("/webhook/razorpay", handlePaymentWebhook);

const userRouter = express.Router();
userRouter.post("/create-order-razorpay", requireAuth, createPaymentOrder);
userRouter.post("/verify-payment-razorpay", requireAuth, verifyPayment);

export { publicRouter, userRouter };

export default router;
