import express from "express";
import nodemailer from "nodemailer";
import Order from "../models/Order.js";
import Product from "../models/Product.js";
import Warranty from "../models/Warranty.js";
import Setting from "../models/Setting.js";
import Chat from "../models/Chat.js";
import BankAccount from "../models/BankAccount.js";
import Voucher from "../models/Voucher.js";
import {
  protectAdmin,
  protectUser,
  protectUserOrAdmin,
  requirePermission,
  canAccessUserData
} from "../middleware/authMiddleware.js";
import { createUploader } from "../utils/upload.js";
import { removeTempFile } from "../utils/paths.js";
import { isValidObjectId, isNonEmptyString, toFiniteNumber, asString } from "../utils/validate.js";

const router = express.Router();

const upload = createUploader({
  subDir: "orders",
  prefix: "order",
  allowPdf: true,
  maxFiles: 1
});

const errorPayload = (error) =>
  process.env.NODE_ENV === "production" ? "Internal Server Error" : error.message;

const COD_TAX_RATE = 0.04;
const MAX_ITEMS_PER_ORDER = 50;
const MAX_QUANTITY_PER_ITEM = 99;

const sendEmail = async (to, subject, text) => {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.warn("⚠️ Email Config Missing: Skipping email.");
    return;
  }

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    }
  });

  try {
    await transporter.sendMail({ from: process.env.EMAIL_USER, to, subject, text });
    console.log(`📧 Email sent to ${to}`);
  } catch (error) {
    console.error("❌ Email send failed:", error.message);
  }
};

const createWarranties = async (order, startDate) => {
  for (const item of order.products) {
    try {
  const product = await Product.findById(item.product);
      if (product && product.warranty > 0) {
        const expiryDate = new Date(startDate);
        expiryDate.setDate(expiryDate.getDate() + product.warranty);

        const warranty = new Warranty({
          user: order.user,
          product: item.product,
          productName: item.title,
          quantity: item.quantity,
          validUntil: expiryDate,
          orderId: order._id
        });
        await warranty.save();
      }
    } catch (err) {
      console.error(`Failed to create warranty for item ${item.product}:`, err);
    }
  }
};

/**
 * Rebuilds the order from trusted data. Prices, delivery charges, COD tax and
 * voucher discounts all come from the database, never from the request body —
 * otherwise a customer can post totalCost=1 and buy anything for one rupee.
 */
const priceOrder = async ({ requestedItems, paymentMethod, voucherCode }) => {
  const items = [];
  let subtotal = 0;
  let deliveryCharges = 0;
  let maxDeliveryDays = 0;
  let codEligible = true;

  for (const requested of requestedItems) {
    const productId = asString(requested?.product || requested?.id);
    const quantity = toFiniteNumber(requested?.quantity);

    if (!isValidObjectId(productId)) {
      return { error: "Invalid product in cart" };
    }
    if (quantity === null || !Number.isInteger(quantity) || quantity < 1 || quantity > MAX_QUANTITY_PER_ITEM) {
      return { error: "Invalid quantity in cart" };
    }

    const product = await Product.findById(productId);
    if (!product) return { error: "A product in your cart no longer exists" };
    if (!product.isAvailable) return { error: `${product.title} is currently unavailable` };
    if (!product.codAvailable) codEligible = false;

    const price = Number(product.price) || 0;
    subtotal += price * quantity;
    deliveryCharges += Number(product.deliveryCharges) || 0;
    maxDeliveryDays = Math.max(maxDeliveryDays, Number(product.deliveryTimeMax) || 0);

    items.push({
      product: product._id,
      quantity,
      title: product.title,
      price
    });
  }

  if (paymentMethod === "cod" && !codEligible) {
    return { error: "Cash on delivery is not available for one or more items in your cart" };
  }

  let discount = 0;
  let appliedVoucher = null;

  if (paymentMethod !== "cod" && isNonEmptyString(voucherCode)) {
    const voucher = await Voucher.findOne({ code: voucherCode.trim().toUpperCase(), isActive: true });
    if (!voucher) return { error: "Invalid or inactive voucher code" };
    if (subtotal < (Number(voucher.minOrderValue) || 0)) {
      return { error: `Minimum order value of ${voucher.minOrderValue} required for this voucher` };
    }

    let eligibleSubtotal = subtotal;
    if (voucher.applicability !== "all") {
      eligibleSubtotal = 0;
      for (const item of items) {
    const product = await Product.findById(item.product).select("category section");
        const matchesCategory =
          voucher.applicability === "category" && String(product?.category) === String(voucher.targetId);
        const matchesSection =
          voucher.applicability === "section" && String(product?.section) === String(voucher.targetId);
        if (matchesCategory || matchesSection) {
          eligibleSubtotal += item.price * item.quantity;
        }
      }
    }

    if (eligibleSubtotal > 0) {
      discount =
        voucher.discountType === "fixed"
          ? Math.min(Number(voucher.value) || 0, eligibleSubtotal)
          : (eligibleSubtotal * (Number(voucher.value) || 0)) / 100;
      discount = Math.max(0, Math.round(discount));
    }
    appliedVoucher = voucher.code;
  }

  let onlinePaid;
  let codAmount;

  if (paymentMethod === "cod") {
    const codTax = Math.round(subtotal * COD_TAX_RATE);
    onlinePaid = deliveryCharges;
    codAmount = subtotal + codTax;
  } else {
    onlinePaid = Math.max(0, subtotal + deliveryCharges - discount);
    codAmount = 0;
  }

  return {
    items,
    subtotal,
    onlinePaid,
    codAmount,
    totalCost: onlinePaid + codAmount,
    maxDeliveryDays,
    appliedVoucher
  };
};

// GET: Fetch ALL orders
router.get("/", protectAdmin, requirePermission("orders", "stats"), async (req, res) => {
  try {
    const now = new Date();
    const expiredOrders = await Order.find({
      status: "Verified",
      deliveryTime: { $lte: now }
    });

    for (const order of expiredOrders) {
      order.status = "Delivered";
      await createWarranties(order, order.deliveryTime);
      await order.save();
    }

    const orders = await Order.find({})
      .populate("user", "name phone email")
      .populate("bankAccount", "bankName accountNumber")
      .sort({ createdAt: -1 });
    res.json(orders);
  } catch (error) {
    res.status(500).json({ message: "Error fetching orders", error: errorPayload(error) });
  }
});

// GET: Fetch orders by User ID (own orders only, unless admin)
router.get("/user/:userId", protectUserOrAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    if (!isValidObjectId(userId)) return res.status(400).json({ message: "Invalid user id" });
    if (!canAccessUserData(req, userId)) {
      return res.status(403).json({ message: "Not authorized to view these orders" });
    }

    const orders = await Order.find({ user: userId })
      .populate("bankAccount", "bankName")
      .sort({ createdAt: -1 });
    res.json(orders);
  } catch (error) {
    res.status(500).json({ message: "Error fetching user orders", error: errorPayload(error) });
  }
});

// PUT: Update Order Status
router.put("/:id/status", protectAdmin, requirePermission("orders"), async (req, res) => {
  try {
    const { status } = req.body;
    const validStatuses = ["Non Verified", "Verified", "Delivered", "Declined"];

    if (!isValidObjectId(req.params.id)) return res.status(400).json({ message: "Invalid order id" });
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ message: "Invalid status" });
    }

    const order = await Order.findById(req.params.id).populate("user", "email name");
    if (!order) return res.status(404).json({ message: "Order not found" });

    const oldStatus = order.status;
    order.status = status;

    if (status === "Verified" && oldStatus !== "Verified") {
      const date = new Date();
      date.setDate(date.getDate() + order.maxDeliveryDays);
      order.deliveryTime = date;

      if (order.user && order.user.email) {
        const emailText = `Hello ${order.user.name},\n\nYour order #${order.id.slice(-6)} at Pak EV has been VERIFIED!\n\nEstimated Delivery: ${date.toDateString()}\n\nThank you for shopping with us.`;
        await sendEmail(order.user.email, "Order Verified - Pak EV", emailText);
      }
    }

    if (status === "Delivered" && oldStatus !== "Delivered") {
      await createWarranties(order, new Date());
    }

    await order.save();
    res.json(order);
  } catch (error) {
    console.error("Update Error:", error.message);
    res.status(500).json({ message: "Error updating order", error: errorPayload(error) });
  }
});

// PUT: Update Order DELIVERY PROOF (Admin)
router.put(
  "/:id/delivery-proof",
  protectAdmin,
  requirePermission("orders"),
  upload.single("receipt"),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "Receipt file is required" });
      }
      if (!isValidObjectId(req.params.id)) {
        removeTempFile(req.file);
        return res.status(400).json({ message: "Invalid order id" });
      }

      const order = await Order.findById(req.params.id);
      if (!order) {
        removeTempFile(req.file);
        return res.status(404).json({ message: "Order not found" });
      }

      const newProofPath = `/uploads/orders/${req.file.filename}`;
      order.deliveryScreenshot = newProofPath;
      await order.save();

      if (order.user) {
        const chatMessage = new Chat({
          sender: "ADMIN",
          receiver: order.user.toString(),
          message: `Order #${order.id.slice(-6)}: Here is your delivery proof: ${newProofPath}`
        });
        await chatMessage.save();
      }

      res.json({ message: "Delivery proof updated and sent to chat", path: newProofPath });
    } catch (error) {
      removeTempFile(req.file);
      res.status(500).json({ message: "Error updating delivery proof", error: errorPayload(error) });
    }
  }
);

// POST: Create new order
router.post("/", protectUser, upload.single("paymentScreenshot"), async (req, res) => {
  try {
    const {
      products,
      bankAccount,
      recipientName,
      shippingAddress,
      postalCode,
      contactNumber,
      paymentMethod,
      voucherCode
    } = req.body;

    if (!req.file) {
      return res.status(400).json({ message: "Payment screenshot is required" });
    }

    if (
      !isNonEmptyString(recipientName) ||
      !isNonEmptyString(shippingAddress) ||
      !isNonEmptyString(postalCode) ||
      !isNonEmptyString(contactNumber)
    ) {
      removeTempFile(req.file);
      return res.status(400).json({ message: "All shipping details are required" });
    }

    if (!/^\d{1,10}$/.test(postalCode.trim()) || !/^\d{7,15}$/.test(contactNumber.trim())) {
      removeTempFile(req.file);
      return res.status(400).json({ message: "Postal code and contact number must be numeric" });
    }

    if (!isValidObjectId(bankAccount) || !(await BankAccount.exists({ _id: bankAccount }))) {
      removeTempFile(req.file);
      return res.status(400).json({ message: "A valid bank account must be selected" });
    }

    let requestedItems;
    try {
      requestedItems = typeof products === "string" ? JSON.parse(products) : products;
    } catch {
      removeTempFile(req.file);
      return res.status(400).json({ message: "Invalid cart payload" });
    }

    if (!Array.isArray(requestedItems) || requestedItems.length === 0 || requestedItems.length > MAX_ITEMS_PER_ORDER) {
      removeTempFile(req.file);
      return res.status(400).json({ message: "Invalid cart payload" });
    }

    const method = paymentMethod === "cod" ? "cod" : "online";
    const pricing = await priceOrder({ requestedItems, paymentMethod: method, voucherCode });

    if (pricing.error) {
      removeTempFile(req.file);
      return res.status(400).json({ message: pricing.error });
    }

    const order = new Order({
      // Ownership always comes from the authenticated session, never the body.
      user: req.user._id,
      products: pricing.items,
      totalCost: pricing.totalCost,
      onlinePaid: pricing.onlinePaid,
      codAmount: pricing.codAmount,
      bankAccount,
      deliveryTime: null,
      maxDeliveryDays: pricing.maxDeliveryDays,
      paymentScreenshot: `/uploads/orders/${req.file.filename}`,
      recipientName: recipientName.trim().slice(0, 120),
      shippingAddress: shippingAddress.trim().slice(0, 500),
      postalCode: postalCode.trim(),
      contactNumber: contactNumber.trim()
    });

    const savedOrder = await order.save();

    const adminSetting = await Setting.findOne({ key: "admin_email" });
    if (adminSetting && adminSetting.value) {
      const emailText = `New Order Received!\n\nOrder ID: #${savedOrder.id.slice(-6)}\nTotal Amount: Rs ${pricing.totalCost}\nOnline Paid: Rs ${pricing.onlinePaid}\nRecipient: ${order.recipientName}\nContact: ${order.contactNumber}\nAddress: ${order.shippingAddress}, ${order.postalCode}\n\nPlease check the admin dashboard for details.`;
      await sendEmail(adminSetting.value, "New Order Alert - Pak EV", emailText);
    }

    res.status(201).json(savedOrder);
  } catch (error) {
    removeTempFile(req.file);
    res.status(500).json({ message: "Error processing order", error: errorPayload(error) });
  }
});

export default router;
