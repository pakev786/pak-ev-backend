import express from "express";
import Review from "../models/Review.js";
import Order from "../models/Order.js";

const router = express.Router();

// GET: Fetch reviews for a specific product
router.get("/product/:productId", async (req, res) => {
  try {
    const reviews = await Review.find({ product: req.params.productId })
      .populate('user', 'name')
      .sort({ createdAt: -1 });
    res.json(reviews);
  } catch (error) {
    res.status(500).json({ message: "Error fetching reviews", error: error.message });
  }
});

// GET: Check eligibility to review (User must have bought & received the item)
router.get("/check-eligibility/:productId/:userId", async (req, res) => {
  try {
    const { productId, userId } = req.params;

    // Find a Delivered order from this user containing the product
    const order = await Order.findOne({
      user: userId,
      status: 'Delivered',
      "products.product": productId
    });

    if (!order) {
      return res.json({ canReview: false });
    }

    // Check if they already reviewed this product for this order (optional constraint)
    // Or allow multiple reviews if bought multiple times? Let's assume 1 review per order.
    const existingReview = await Review.findOne({ 
      user: userId, 
      product: productId,
      order: order._id // Tie review to specific order to prevent spamming
    });

    if (existingReview) {
      return res.json({ canReview: false, message: "Already reviewed for this order" });
    }

    res.json({ canReview: true, orderId: order._id });
  } catch (error) {
    res.status(500).json({ message: "Error checking eligibility", error: error.message });
  }
});

// POST: Submit a review
router.post("/", async (req, res) => {
  try {
    const { user, product, order, rating, comment } = req.body;

    // Double check eligibility on server side
    const validOrder = await Order.findOne({
      _id: order,
      user: user,
      status: 'Delivered',
      "products.product": product
    });

    if (!validOrder) {
      return res.status(403).json({ message: "You are not eligible to review this product." });
    }

    // Check duplicate
    const existing = await Review.findOne({ user, product, order });
    if (existing) {
        return res.status(400).json({ message: "You have already reviewed this purchase." });
    }

    const newReview = new Review({
      user,
      product,
      order,
      rating,
      comment
    });

    const savedReview = await newReview.save();
    
    // Populate user name for immediate display on frontend
    await savedReview.populate('user', 'name');

    res.status(201).json(savedReview);

  } catch (error) {
    res.status(500).json({ message: "Error saving review", error: error.message });
  }
});

export default router;