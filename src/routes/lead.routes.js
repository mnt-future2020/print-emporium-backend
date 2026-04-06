import express from "express";
import {
  createLead,
  getAllLeads,
  updateLead,
  deleteLead,
} from "../controllers/lead.controller.js";
import { requireAdmin } from "../middleware/auth.middleware.js";

const router = express.Router();

// Public route to submit contact form
router.post("/", createLead);

// Protected routes for admin to manage leads
router.get("/all", requireAdmin, getAllLeads);
router.patch("/:id", requireAdmin, updateLead);
router.delete("/:id", requireAdmin, deleteLead);

export default router;
