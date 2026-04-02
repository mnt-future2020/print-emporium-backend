import Coupon from "../models/coupon.model.js";

/**
 * Get all coupons (Admin)
 */
export const getAllCoupons = async (req, res) => {
  try {
    const coupons = await Coupon.find().sort({ createdAt: -1 });
    res.json({ success: true, data: coupons });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Get all active coupons (Public)
 */
export const getActiveCoupons = async (req, res) => {
  try {
    const now = new Date();
    const coupons = await Coupon.find({
      isActive: true,
      displayInCheckout: true,
      $or: [
        { expiryDate: { $exists: false } }, // No expiry date
        { expiryDate: { $gt: now } }, // Not yet expired
      ],
    })
      .select("code type value description minOrderAmount maxDiscountAmount")
      .sort({ createdAt: -1 });

    res.json({ success: true, data: coupons });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Create a new coupon (Admin)
 */
export const createCoupon = async (req, res) => {
  try {
    const couponData = {
      ...req.body,
      createdBy: req.user.id,
    };
    const coupon = await Coupon.create(couponData);
    res.status(201).json({ success: true, data: coupon });
  } catch (error) {
    if (error.code === 11000) {
      return res
        .status(400)
        .json({ success: false, message: "Coupon code already exists" });
    }
    res.status(400).json({ success: false, message: error.message });
  }
};

/**
 * Update a coupon (Admin)
 */
export const updateCoupon = async (req, res) => {
  try {
    const coupon = await Coupon.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    if (!coupon) {
      return res
        .status(404)
        .json({ success: false, message: "Coupon not found" });
    }
    res.json({ success: true, data: coupon });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

/**
 * Delete a coupon (Admin)
 */
export const deleteCoupon = async (req, res) => {
  try {
    const coupon = await Coupon.findByIdAndDelete(req.params.id);
    if (!coupon) {
      return res
        .status(404)
        .json({ success: false, message: "Coupon not found" });
    }
    res.json({ success: true, message: "Coupon deleted successfully" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Bulk create coupons (Admin)
 */
export const bulkCreateCoupons = async (req, res) => {
  try {
    const {
      count,
      prefix,
      type,
      value,
      minOrderAmount,
      expiryDate,
      usageLimit,
      description,
      displayInCheckout,
    } = req.body;

    if (!count || count <= 0) {
      return res
        .status(400)
        .json({ success: false, message: "Valid count is required" });
    }

    const coupons = [];
    const existingCodes = new Set(await Coupon.find().distinct("code"));

    for (let i = 0; i < count; i++) {
      let code;
      do {
        const randomStr = Math.random()
          .toString(36)
          .substring(2, 8)
          .toUpperCase();
        code = prefix ? `${prefix}${randomStr}` : randomStr;
      } while (existingCodes.has(code));

      existingCodes.add(code);
      coupons.push({
        code,
        type,
        value: type === "free-delivery" ? 0 : value,
        minOrderAmount: minOrderAmount || 0,
        expiryDate,
        usageLimit,
        description:
          description ||
          (type === "free-delivery" ? "Free Delivery Coupon" : ""),
        displayInCheckout:
          displayInCheckout !== undefined ? displayInCheckout : true,
        createdBy: req.user.id,
      });
    }

    const createdCoupons = await Coupon.insertMany(coupons);
    res.status(201).json({
      success: true,
      data: createdCoupons,
      count: createdCoupons.length,
    });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

/**
 * Validate a coupon code (Public)
 */
export const validateCoupon = async (req, res) => {
  try {
    const { code, orderAmount } = req.body;

    if (!code) {
      return res
        .status(400)
        .json({ success: false, message: "Coupon code is required" });
    }

    const coupon = await Coupon.findOne({
      code: code.toUpperCase(),
      isActive: true,
    });

    if (!coupon) {
      return res
        .status(404)
        .json({ success: false, message: "Invalid coupon code" });
    }

    // Check expiry
    if (coupon.expiryDate && new Date() > new Date(coupon.expiryDate)) {
      return res
        .status(400)
        .json({ success: false, message: "Coupon has expired" });
    }

    // Check usage limit
    if (coupon.usageLimit && coupon.usedCount >= coupon.usageLimit) {
      return res
        .status(400)
        .json({ success: false, message: "Coupon usage limit reached" });
    }

    // Check minimum order amount
    if (orderAmount < coupon.minOrderAmount) {
      return res.status(400).json({
        success: false,
        message: `Minimum order amount of ₹${coupon.minOrderAmount} required for this coupon`,
      });
    }

    // Calculate discount
    let discount = 0;
    let isFreeDelivery = false;

    if (coupon.type === "free-delivery") {
      isFreeDelivery = true;
      discount = 0; // The actual discount happens by waiving shipping in the UI/Order creation
    } else if (coupon.type === "percentage") {
      discount = (orderAmount * coupon.value) / 100;
      if (coupon.maxDiscountAmount && discount > coupon.maxDiscountAmount) {
        discount = coupon.maxDiscountAmount;
      }
    } else {
      discount = coupon.value;
    }

    res.json({
      success: true,
      data: {
        code: coupon.code,
        type: coupon.type,
        value: coupon.value,
        discount: discount,
        isFreeDelivery: isFreeDelivery,
        description: coupon.description,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
