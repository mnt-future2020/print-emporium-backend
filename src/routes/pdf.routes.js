import express from "express";
import {
  generateOrderSlip,
  generateShippingLabel,
} from "../controllers/pdf.controller.js";
import { requireAdmin } from "../middleware/auth.middleware.js";

const router = express.Router();

router.get("/order-slip/:orderId", requireAdmin, generateOrderSlip);
router.post("/shipping-label/:orderId", requireAdmin, generateShippingLabel);

export default router;
