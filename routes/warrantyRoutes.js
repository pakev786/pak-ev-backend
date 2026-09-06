import express from "express";
import Warranty from "../models/Warranty.js";
import { protectUserOrAdmin, canAccessUserData } from "../middleware/authMiddleware.js";
import { isValidObjectId } from "../utils/validate.js";

const router = express.Router();

// GET: Fetch warranties by User ID (own warranties only, unless admin)
router.get("/user/:userId", protectUserOrAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    if (!isValidObjectId(userId)) return res.status(400).json({ message: "Invalid user id" });
    if (!canAccessUserData(req, userId)) {
      return res.status(403).json({ message: "Not authorized to view these warranties" });
    }

    // Return active warranties (validUntil >= today) sorted by expiration
    const warranties = await Warranty.find({
      user: userId,
      validUntil: { $gte: new Date() }
    }).sort({ validUntil: 1 });

    res.json(warranties);
  } catch (error) {
    res.status(500).json({
      message: "Error fetching user warranties",
      error: process.env.NODE_ENV === "production" ? "Internal Server Error" : error.message
    });
  }
});

export default router;
