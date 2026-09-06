import express from "express";
import Review from "../models/Review.js";
import Order from "../models/Order.js";
import { protectUser, protectUserOrAdmin, canAccessUserData } from "../middleware/authMiddleware.js";
import { isValidObjectId, isNonEmptyString, toFiniteNumber } from "../utils/validate.js";

const router = express.Router();

const errorPayload = (error) =>
  process.env.NODE_ENV === "production" ? "Internal Server Error" : error.message;

const MAX_COMMENT_LENGTH = 2000;

// GET: Fetch reviews for a specific product
router.get("/product/:productId", async (req, res) => {
  try {
    const { productId } = req.params;
    if (!isValidObjectId(productId)) return res.status(400).json({ message: "Invalid product id" });

    const reviews = await Review.find({ product: productId })
      .populate("user", "name")
      .sort({ createdAt: -1 });
    res.json(reviews);
  } catch (error) {
    res.status(500).json({ message: "Error fetching reviews", error: errorPayload(error) });
  }
});

// GET: Check eligibility to review (purchase history is private, so require auth)
router.get("/check-eligibility/:productId/:userId", protectUserOrAdmin, async (req, res) => {
  try {
    const { productId, userId } = req.params;
    if (!isValidObjectId(productId) || !isValidObjectId(userId)) {
      return res.status(400).json({ message: "Invalid request" });
    }
    if (!canAccessUserData(req, userId)) {
      return res.status(403).json({ message: "Not authorized" });
    }

    const order = await Order.findOne({
      user: userId,
      status: "Delivered",
      "products.product": productId
    });

    if (!order) {
      return res.json({ canReview: false });
    }

    const existingReview = await Review.findOne({
      user: userId,
      product: productId,
      order: order._id
    });

    if (existingReview) {
      return res.json({ canReview: false, message: "Already reviewed for this order" });
    }

    res.json({ canReview: true, orderId: order._id });
  } catch (error) {
    res.status(500).json({ message: "Error checking eligibility", error: errorPayload(error) });
  }
});

// POST: Submit a review
router.post("/", protectUser, async (req, res) => {
  try {
    const { product, order, rating, comment } = req.body;
    // The reviewer is always the authenticated user; a body supplied `user`
    // would let anyone post reviews in someone else's name.
    const userId = req.user._id;

    if (!isValidObjectId(product) || !isValidObjectId(order)) {
      return res.status(400).json({ message: "Invalid review payload" });
    }

    const numericRating = toFiniteNumber(rating);
    if (numericRating === null || !Number.isInteger(numericRating) || numericRating < 1 || numericRating > 5) {
      return res.status(400).json({ message: "Rating must be between 1 and 5" });
    }

    if (!isNonEmptyString(comment)) {
      return res.status(400).json({ message: "Comment is required" });
    }

    const validOrder = await Order.findOne({
      _id: order,
      user: userId,
      status: "Delivered",
      "products.product": product
    });

    if (!validOrder) {
      return res.status(403).json({ message: "You are not eligible to review this product." });
    }

    const existing = await Review.findOne({ user: userId, product, order });
    if (existing) {
      return res.status(400).json({ message: "You have already reviewed this purchase." });
    }

    const newReview = new Review({
      user: userId,
      product,
      order,
      rating: numericRating,
      comment: comment.trim().slice(0, MAX_COMMENT_LENGTH)
    });

    const savedReview = await newReview.save();
    await savedReview.populate("user", "name");

    res.status(201).json(savedReview);
  } catch (error) {
    res.status(500).json({ message: "Error saving review", error: errorPayload(error) });
  }
});

export default router;
