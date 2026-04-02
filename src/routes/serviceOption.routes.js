import express from "express";
import {
  getAllServiceOptions,
  upsertServiceOption,
  deleteServiceOption,
} from "../controllers/serviceOption.controller.js";
import { requireAdmin } from "../middleware/auth.middleware.js";

const router = express.Router();

// Public routes (though these are mainly for dropdowns in dashboard,
// they can be public for price calculators later)
router.get("/", getAllServiceOptions);

// Admin routes
router.put("/", requireAdmin, upsertServiceOption);
router.delete("/:id", requireAdmin, deleteServiceOption);

export default router;
