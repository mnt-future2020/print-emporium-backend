import express from "express";
import { lookupPincode } from "../controllers/pincode.controller.js";

const router = express.Router();

router.get("/:pincode", lookupPincode);

export default router;
