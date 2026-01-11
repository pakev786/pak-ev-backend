import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import nodemailer from "nodemailer"; 
import Order from "../models/Order.js";
import Product from "../models/Product.js";
import Warranty from "../models/Warranty.js";
import Setting from "../models/Setting.js"; 
import User from "../models/User.js"; 

const router = express.Router();

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = 'uploads/orders/';
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, `order-${uniqueSuffix}${path.extname(file.originalname)}`);
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 5000000 }, 
  fileFilter: (req, file, cb) => {
    const filetypes = /jpeg|jpg|png|webp|pdf/;
    const mimetype = filetypes.test(file.mimetype);
    if (mimetype) return cb(null, true);
    cb(new Error('Only images and PDFs are allowed'));
  }
});

const sendEmail = async (to, subject, text) => {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.warn("⚠️ Email Config Missing: Skipping email.");
    return;
  }
  
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    }
  });

  try {
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to,
      subject,
      text
    });
    console.log(`📧 Email sent to ${to}`);
  } catch (error) {
    console.error("❌ Email send failed:", error.message);
  }
};

const deleteScreenshot = (screenshotPath) => {
  if (!screenshotPath) return;
  const cleanPath = screenshotPath.startsWith('/') ? screenshotPath.substring(1) : screenshotPath;
  const fullPath = path.resolve(cleanPath);
  if (fs.existsSync(fullPath)) {
    try {
      fs.unlinkSync(fullPath);
    } catch (err) {
      console.error(`Failed to delete screenshot: ${err.message}`);
    }
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

// GET: Fetch ALL orders
router.get("/", async (req, res) => {
  try {
    const now = new Date();
    const expiredOrders = await Order.find({
      status: 'Verified',
      deliveryTime: { $lte: now }
    });

    for (const order of expiredOrders) {
      order.status = 'Delivered';
      deleteScreenshot(order.paymentScreenshot);
      order.paymentScreenshot = null;
      await createWarranties(order, order.deliveryTime);
      await order.save();
    }

    const orders = await Order.find({})
      .populate('user', 'name phone email')
      .populate('bankAccount', 'bankName accountNumber')
      .sort({ createdAt: -1 });
    res.json(orders);
  } catch (error) {
    res.status(500).json({ message: "Error fetching orders", error: error.message });
  }
});

// GET: Fetch orders by User ID
router.get("/user/:userId", async (req, res) => {
  try {
    const orders = await Order.find({ user: req.params.userId })
      .populate('bankAccount', 'bankName')
      .sort({ createdAt: -1 });
    res.json(orders);
  } catch (error) {
    res.status(500).json({ message: "Error fetching user orders", error: error.message });
  }
});

// PUT: Update Order Status
router.put("/:id/status", async (req, res) => {
  try {
    const { status } = req.body;
    const validStatuses = ['Non Verified', 'Verified', 'Delivered', 'Declined'];
    
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ message: "Invalid status" });
    }

    const order = await Order.findById(req.params.id).populate('user', 'email name');
    if (!order) return res.status(404).json({ message: "Order not found" });

    const oldStatus = order.status;
    order.status = status;

    if (status === 'Verified' && oldStatus !== 'Verified') {
        const date = new Date();
        date.setDate(date.getDate() + order.maxDeliveryDays);
        order.deliveryTime = date;

        if (order.user && order.user.email) {
          const emailText = `Hello ${order.user.name},\n\nYour order #${order.id.slice(-6)} at Pak EV has been VERIFIED!\n\nEstimated Delivery: ${date.toDateString()}\n\nThank you for shopping with us.`;
          await sendEmail(order.user.email, 'Order Verified - Pak EV', emailText);
        }
    }

    if (status === 'Delivered' && oldStatus !== 'Delivered') {
        deleteScreenshot(order.paymentScreenshot);
        order.paymentScreenshot = null; 
        await createWarranties(order, new Date());
    }

    await order.save();
    res.json(order);
  } catch (error) {
    console.error("Update Error:", error);
    res.status(500).json({ message: "Error updating order", error: error.message });
  }
});

// POST: Create new order
router.post("/", upload.single('paymentScreenshot'), async (req, res) => {
  try {
    const { 
      user, products, totalCost, onlinePaid, codAmount, bankAccount, deliveryTime,
      recipientName, shippingAddress, postalCode, contactNumber
    } = req.body;

    if (!req.file) {
      return res.status(400).json({ message: "Payment screenshot is required" });
    }

    if (!recipientName || !shippingAddress || !postalCode || !contactNumber) {
        return res.status(400).json({ message: "All shipping details are required" });
    }

    const order = new Order({
      user,
      products: JSON.parse(products),
      totalCost,
      onlinePaid,
      codAmount,
      bankAccount,
      deliveryTime: null,
      maxDeliveryDays: deliveryTime,
      paymentScreenshot: `/uploads/orders/${req.file.filename}`,
      recipientName,
      shippingAddress,
      postalCode,
      contactNumber
    });

    const savedOrder = await order.save();

    const adminSetting = await Setting.findOne({ key: 'admin_email' });
    if (adminSetting && adminSetting.value) {
      const emailText = `New Order Received!\n\nOrder ID: #${savedOrder.id.slice(-6)}\nTotal Amount: Rs ${totalCost}\nOnline Paid: Rs ${onlinePaid}\nRecipient: ${recipientName}\nContact: ${contactNumber}\nAddress: ${shippingAddress}, ${postalCode}\n\nPlease check the admin dashboard for details.`;
      await sendEmail(adminSetting.value, 'New Order Alert - Pak EV', emailText);
    }

    res.status(201).json(savedOrder);

  } catch (error) {
    if (req.file) fs.unlinkSync(req.file.path);
    res.status(500).json({ message: "Error processing order", error: error.message });
  }
});

export default router;