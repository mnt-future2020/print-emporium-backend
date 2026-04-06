import express from "express";
import {
  getAllSlides,
  upsertSlide,
  deleteSlide,
} from "../controllers/hero-slide.controller.js";
import { requireAdmin } from "../middleware/auth.middleware.js";

const router = express.Router();

// Fetching routes
router.get("/", getAllSlides);

// Mutation routes (Strictly Admin Session only)
router.put("/", requireAdmin, upsertSlide);
router.delete("/:id", requireAdmin, deleteSlide);

export default router;
