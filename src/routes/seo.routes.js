import express from "express";
import {
  getAllSEOSettings,
  getSEOSettingsByPage,
  upsertSEOSettings,
  deleteSEOSettings,
} from "../controllers/seo.controller.js";
import { requireAdmin } from "../middleware/auth.middleware.js";

const router = express.Router();

// Fetching routes (Global Signature/Session protection applied in server.js)
router.get("/", getAllSEOSettings);
router.get("/:pageName", getSEOSettingsByPage);

// Mutation routes (Strictly Admin Session only)
router.put("/", requireAdmin, upsertSEOSettings);
router.delete("/:pageName", requireAdmin, deleteSEOSettings);

export default router;
