import express from "express";
import Warranty from "../models/Warranty.js";
import { protectUser } from "../middleware/authMiddleware.js";

const router = express.Router();

// GET: Fetch warranties by User ID
router.get("/user/:userId", protectUser, async (req, res) => {
  try {
    // Return active warranties (validUntil >= today) sorted by expiration
    const warranties = await Warranty.find({ 
      user: req.params.userId,
      validUntil: { $gte: new Date() }
    })
    .sort({ validUntil: 1 });
    
    res.json(warranties);
  } catch (error) {
    res.status(500).json({ message: "Error fetching user warranties", error: process.env.NODE_ENV === 'production' ? 'Internal Server Error' : error.message });
  }
});

export default router;