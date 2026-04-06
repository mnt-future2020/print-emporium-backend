import express from "express";
import {
  createOrder,
  getUserOrders,
  getOrderById,
  cancelOrder,
  reorderOrder,
  getAllOrders,
  updateOrderStatus,
  getOrderStats,
  uploadOrderFile,
  downloadInvoice,
} from "../controllers/order.controller.js";
import {
  requireAuth,
  requireAdmin,
  requireAdminOrEmployee,
} from "../middleware/auth.middleware.js";

const router = express.Router();

// File upload route (require authentication)
router.post("/upload-file", requireAuth, uploadOrderFile);

// Admin and Employee routes (must come before user /:id routes to avoid conflicts)
router.get("/admin/all", requireAdminOrEmployee, getAllOrders);
router.get("/admin/stats", requireAdmin, getOrderStats);
router.get("/admin/:id", requireAdminOrEmployee, getOrderById);
router.put("/admin/:id/status", requireAdminOrEmployee, updateOrderStatus);

// User routes (require authentication)
router.post("/", requireAuth, createOrder);
router.get("/my-orders", requireAuth, getUserOrders);
router.get("/:id", requireAuth, getOrderById);
router.get("/:id/invoice", requireAuth, downloadInvoice);
router.post("/:id/cancel", requireAuth, cancelOrder);
router.post("/:id/reorder", requireAuth, reorderOrder);

export default router;
