import express from "express";
import {
  getAllServices,
  getServiceById,
  upsertService,
  deleteService,
} from "../controllers/service.controller.js";
import { requireAdmin } from "../middleware/auth.middleware.js";

const router = express.Router();

// Fetching routes (Global Signature/Session protection applied in server.js for /api/services)
router.get("/", getAllServices);
router.get("/:id", getServiceById);

// Mutation routes (Strictly Admin Session only)
router.put("/", requireAdmin, upsertService);
router.delete("/:id", requireAdmin, deleteService);

export default router;
