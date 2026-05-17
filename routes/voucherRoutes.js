import express from "express";
import { protectAdmin } from "../middleware/authMiddleware.js";
import Voucher from "../models/Voucher.js";

const router = express.Router();

// GET: Fetch all vouchers
router.get("/", async (req, res) => {
  try {
    const vouchers = await Voucher.find({}).sort({ createdAt: -1 });
    res.json(vouchers);
  } catch (error) {
    res.status(500).json({ message: "Error fetching vouchers", error: process.env.NODE_ENV === 'production' ? 'Internal Server Error' : error.message });
  }
});

// POST: Create Voucher
router.post("/", protectAdmin, async (req, res) => {
  try {
    const { code, discountType, value, applicability, targetId, minOrderValue, isActive } = req.body;
    
    const existing = await Voucher.findOne({ code: code.toUpperCase() });
    if (existing) {
      return res.status(400).json({ message: "Voucher code already exists" });
    }

    const voucher = new Voucher({
      code,
      discountType,
      value,
      applicability,
      targetId: targetId || null,
      minOrderValue: minOrderValue || 0,
      isActive: isActive !== undefined ? isActive : true
    });

    const savedVoucher = await voucher.save();
    res.status(201).json(savedVoucher);
  } catch (error) {
    res.status(500).json({ message: "Error creating voucher", error: process.env.NODE_ENV === 'production' ? 'Internal Server Error' : error.message });
  }
});

// PUT: Update Voucher
router.put("/:id", protectAdmin, async (req, res) => {
  try {
    const { code, discountType, value, applicability, targetId, minOrderValue, isActive } = req.body;
    
    // Check code uniqueness if changing code
    if (code) {
      const existing = await Voucher.findOne({ code: code.toUpperCase(), _id: { $ne: req.params.id } });
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
router.delete("/:id", protectAdmin, async (req, res) => {
  try {
    await Voucher.findByIdAndDelete(req.params.id);
    res.json({ message: "Voucher deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Error deleting voucher", error: process.env.NODE_ENV === 'production' ? 'Internal Server Error' : error.message });
  }
});

// POST: Validate Voucher (for checkout)
router.post("/validate", async (req, res) => {
  try {
    const { code } = req.body;
    const voucher = await Voucher.findOne({ code: code.toUpperCase(), isActive: true });

    if (!voucher) {
      return res.status(404).json({ message: "Invalid or inactive voucher code" });
    }

    res.json(voucher);
  } catch (error) {
    res.status(500).json({ message: "Error validating voucher", error: process.env.NODE_ENV === 'production' ? 'Internal Server Error' : error.message });
  }
});

export default router;