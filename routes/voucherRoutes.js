import express from "express";
import { protectAdmin, protectUserOrAdmin, requirePermission } from "../middleware/authMiddleware.js";
import Voucher from "../models/Voucher.js";
import { isNonEmptyString, isValidObjectId, asString, toFiniteNumber } from "../utils/validate.js";

const router = express.Router();

// GET: Fetch all vouchers (admin dashboard only - the public endpoint below
// validates a single code instead of handing out every active discount).
router.get("/", protectAdmin, requirePermission("vouchers"), async (req, res) => {
  try {
    const vouchers = await Voucher.find({}).sort({ createdAt: -1 });
    res.json(vouchers);
  } catch (error) {
    res.status(500).json({ message: "Error fetching vouchers", error: process.env.NODE_ENV === 'production' ? 'Internal Server Error' : error.message });
  }
});

// POST: Create Voucher
router.post("/", protectAdmin, requirePermission("vouchers"), async (req, res) => {
  try {
        const { code, discountType, value, applicability, targetId, minOrderValue, isActive } = req.body;

    if (!isNonEmptyString(code) || code.trim().length > 40) {
      return res.status(400).json({ message: "Voucher code is required" });
    }
    if (!['fixed', 'percentage'].includes(discountType)) {
      return res.status(400).json({ message: "Invalid discount type" });
    }
    const numericValue = toFiniteNumber(value);
    if (numericValue === null || numericValue <= 0 || (discountType === 'percentage' && numericValue > 100)) {
      return res.status(400).json({ message: "Invalid discount value" });
    }
    if (applicability !== undefined && !['all', 'category', 'section'].includes(applicability)) {
      return res.status(400).json({ message: "Invalid applicability" });
    }
    if (applicability && applicability !== 'all' && !isValidObjectId(targetId)) {
      return res.status(400).json({ message: "A valid target is required" });
    }

    const existing = await Voucher.findOne({ code: asString(code).toUpperCase() });
    if (existing) {
      return res.status(400).json({ message: "Voucher code already exists" });
    }

        const voucher = new Voucher({
      code: asString(code).toUpperCase(),
      discountType,
      value: numericValue,
      applicability,
      targetId: applicability && applicability !== 'all' ? asString(targetId) : null,
      minOrderValue: Math.max(0, toFiniteNumber(minOrderValue) || 0),
      isActive: isActive !== undefined ? isActive === true || isActive === 'true' : true
    });

    const savedVoucher = await voucher.save();
    res.status(201).json(savedVoucher);
  } catch (error) {
    res.status(500).json({ message: "Error creating voucher", error: process.env.NODE_ENV === 'production' ? 'Internal Server Error' : error.message });
  }
});

// PUT: Update Voucher
router.put("/:id", protectAdmin, requirePermission("vouchers"), async (req, res) => {
  try {
        const { code, discountType, value, applicability, targetId, minOrderValue, isActive } = req.body;

    if (!isValidObjectId(req.params.id)) return res.status(400).json({ message: "Invalid voucher id" });
    if (code !== undefined && (!isNonEmptyString(code) || code.trim().length > 40)) {
      return res.status(400).json({ message: "Invalid voucher code" });
    }
    if (discountType !== undefined && !['fixed', 'percentage'].includes(discountType)) {
      return res.status(400).json({ message: "Invalid discount type" });
    }
    if (value !== undefined) {
      const numericValue = toFiniteNumber(value);
      if (numericValue === null || numericValue <= 0 || (discountType === 'percentage' && numericValue > 100)) {
        return res.status(400).json({ message: "Invalid discount value" });
      }
    }
    if (applicability !== undefined && !['all', 'category', 'section'].includes(applicability)) {
      return res.status(400).json({ message: "Invalid applicability" });
    }

    // Check code uniqueness if changing code
    if (code) {
      const existing = await Voucher.findOne({ code: asString(code).toUpperCase(), _id: { $ne: req.params.id } });
      if (existing) {
        return res.status(400).json({ message: "Voucher code already exists" });
      }
    }

    const updatedVoucher = await Voucher.findByIdAndUpdate(
      req.params.id,
      { code, discountType, value, applicability, targetId, minOrderValue, isActive },
      { new: true }
    );

    if (!updatedVoucher) return res.status(404).json({ message: "Voucher not found" });
    res.json(updatedVoucher);

  } catch (error) {
    res.status(500).json({ message: "Error updating voucher", error: process.env.NODE_ENV === 'production' ? 'Internal Server Error' : error.message });
  }
});

// DELETE: Remove Voucher
router.delete("/:id", protectAdmin, requirePermission("vouchers"), async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) return res.status(400).json({ message: "Invalid voucher id" });
    await Voucher.findByIdAndDelete(req.params.id);
    res.json({ message: "Voucher deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Error deleting voucher", error: process.env.NODE_ENV === 'production' ? 'Internal Server Error' : error.message });
  }
});

// POST: Validate Voucher (for checkout)
router.post("/validate", protectUserOrAdmin, async (req, res) => {
  try {
    const { code } = req.body;
    if (!isNonEmptyString(code) || code.trim().length > 40) {
      return res.status(400).json({ message: "Invalid or inactive voucher code" });
    }
    const voucher = await Voucher.findOne({ code: asString(code).toUpperCase(), isActive: true });

    if (!voucher) {
      return res.status(404).json({ message: "Invalid or inactive voucher code" });
    }

    res.json(voucher);
  } catch (error) {
    res.status(500).json({ message: "Error validating voucher", error: process.env.NODE_ENV === 'production' ? 'Internal Server Error' : error.message });
  }
});

export default router;