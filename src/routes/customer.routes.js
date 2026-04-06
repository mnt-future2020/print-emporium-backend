import express from "express";
import {
  getAllCustomers,
  getCustomerDetails,
} from "../controllers/customer.controller.js";
import { requireAdmin } from "../middleware/auth.middleware.js";

const router = express.Router();

router.get("/", requireAdmin, getAllCustomers);
router.get("/:id", requireAdmin, getCustomerDetails);

export default router;
