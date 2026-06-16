import express from "express";
import {
  getServiceability,
  getCheckoutRate,
  getOrderCouriers,
  pushOrderToShiprocket,
  assignOrderAwb,
  schedulePickup,
  trackOrder,
  getLabel,
  handleWebhook,
} from "../controllers/shiprocket.controller.js";
import {
  requireAuth,
  requireAdminOrEmployee,
} from "../middleware/auth.middleware.js";

const router = express.Router();

// Webhook — public, token-protected via query string / header
router.post("/webhook", handleWebhook);

// Public — used by the checkout page to show rate/ETD for a pincode
router.get("/serviceability", getServiceability);
router.post("/checkout-rate", getCheckoutRate);

// Customer + admin tracking
router.get("/orders/:id/track", requireAuth, trackOrder);

// Admin / employee actions
router.post("/orders/:id/push", requireAdminOrEmployee, pushOrderToShiprocket);
router.get("/orders/:id/couriers", requireAdminOrEmployee, getOrderCouriers);
router.post("/orders/:id/awb", requireAdminOrEmployee, assignOrderAwb);
router.post("/orders/:id/pickup", requireAdminOrEmployee, schedulePickup);
router.get("/orders/:id/label", requireAdminOrEmployee, getLabel);

export default router;
