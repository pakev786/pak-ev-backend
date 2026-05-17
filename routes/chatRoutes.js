import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import Chat from "../models/Chat.js";
import User from "../models/User.js";
import { protectAdmin, protectUser } from "../middleware/authMiddleware.js";

const router = express.Router();

// Configure Multer for Chat Uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = 'uploads/chat/';
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, `chat-${uniqueSuffix}${path.extname(file.originalname)}`);
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 5000000 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    const filetypes = /jpeg|jpg|png|webp|gif|pdf/;
    const mimetype = filetypes.test(file.mimetype);
    if (mimetype) return cb(null, true);
    cb(new Error('Only images and PDFs are allowed'));
  }
});

// GET: Get list of users who have started a chat (For Admin)
router.get("/users", protectAdmin, async (req, res) => {
  try {
    const senderIds = await Chat.distinct("sender", { receiver: "ADMIN" });
    const receiverIds = await Chat.distinct("receiver", { sender: "ADMIN" });
    const userIds = [...new Set([...senderIds, ...receiverIds])];
    
    const users = await User.find({ _id: { $in: userIds } }).select('name email phone');
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: "Error fetching chat users", error: process.env.NODE_ENV === 'production' ? 'Internal Server Error' : error.message });
  }
});

// GET: Get conversation history
router.get("/:userId", protectUser, async (req, res) => {
  try {
    const { userId } = req.params;
    const messages = await Chat.find({
      $or: [
        { sender: userId, receiver: "ADMIN" },
        { sender: "ADMIN", receiver: userId }
      ]
    }).sort({ createdAt: 1 });
    
    res.json(messages);
  } catch (error) {
    res.status(500).json({ message: "Error fetching messages", error: process.env.NODE_ENV === 'production' ? 'Internal Server Error' : error.message });
  }
});

// POST: Send a message (with optional file)
router.post("/", protectUser, upload.single('attachment'), async (req, res) => {
  try {
    const { sender, receiver, message } = req.body;
    
    let content = message || "";

    // If file is uploaded, append its path to the message content
    if (req.file) {
      const filePath = `/uploads/chat/${req.file.filename}`;
      // If there is text, append a newline, otherwise just the path
      content = content ? `${content}\n${filePath}` : filePath;
    }

    if (!content && !req.file) {
      return res.status(400).json({ message: "Message or attachment is required" });
    }

    const newChat = new Chat({ 
      sender, 
      receiver, 
      message: content 
    });
    
    await newChat.save();
    
    res.status(201).json(newChat);
  } catch (error) {
    // Cleanup file if DB save fails
    if (req.file) fs.unlinkSync(req.file.path);
    res.status(500).json({ message: "Error sending message", error: process.env.NODE_ENV === 'production' ? 'Internal Server Error' : error.message });
  }
});

export default router;