import express from "express";
import Chat from "../models/Chat.js";
import User from "../models/User.js";
import {
  protectAdmin,
  protectUserOrAdmin,
  requirePermission,
  canAccessUserData
} from "../middleware/authMiddleware.js";
import { createUploader } from "../utils/upload.js";
import { removeTempFile } from "../utils/paths.js";
import { isValidObjectId, asString } from "../utils/validate.js";

const router = express.Router();

const upload = createUploader({
  subDir: "chat",
  prefix: "chat",
  allowPdf: true,
  allowGif: true,
  maxFiles: 1
});

const errorPayload = (error) =>
  process.env.NODE_ENV === "production" ? "Internal Server Error" : error.message;

const MAX_MESSAGE_LENGTH = 4000;

// GET: Get list of users who have started a chat (For Admin)
router.get("/users", protectAdmin, requirePermission("support"), async (req, res) => {
  try {
    const senderIds = await Chat.distinct("sender", { receiver: "ADMIN" });
    const receiverIds = await Chat.distinct("receiver", { sender: "ADMIN" });
    const userIds = [...new Set([...senderIds, ...receiverIds])].filter((id) => isValidObjectId(id));

    const users = await User.find({ _id: { $in: userIds } }).select("name email phone");
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: "Error fetching chat users", error: errorPayload(error) });
  }
});

// GET: Get conversation history (own conversation only, unless admin)
router.get("/:userId", protectUserOrAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    if (!isValidObjectId(userId)) return res.status(400).json({ message: "Invalid user id" });
    if (!canAccessUserData(req, userId)) {
      return res.status(403).json({ message: "Not authorized to view this conversation" });
    }

    const messages = await Chat.find({
      $or: [
        { sender: userId, receiver: "ADMIN" },
        { sender: "ADMIN", receiver: userId }
      ]
    }).sort({ createdAt: 1 });

    res.json(messages);
  } catch (error) {
    res.status(500).json({ message: "Error fetching messages", error: errorPayload(error) });
  }
});

// POST: Send a message (with optional file)
router.post("/", protectUserOrAdmin, upload.single("attachment"), async (req, res) => {
  try {
    // The sender/receiver pair is derived from the session, so a customer can no
    // longer post messages that appear to come from ADMIN (or from someone else).
    let sender;
    let receiver;

    if (req.admin) {
      const target = asString(req.body.receiver);
      if (!isValidObjectId(target)) {
        removeTempFile(req.file);
        return res.status(400).json({ message: "A valid recipient is required" });
      }
      sender = "ADMIN";
      receiver = target;
    } else {
      sender = String(req.user._id);
      receiver = "ADMIN";
    }

    let content = asString(req.body.message).slice(0, MAX_MESSAGE_LENGTH);

    if (req.file) {
      const filePath = `/uploads/chat/${req.file.filename}`;
      content = content ? `${content}\n${filePath}` : filePath;
    }

    if (!content) {
      return res.status(400).json({ message: "Message or attachment is required" });
    }

    const newChat = new Chat({ sender, receiver, message: content });
    await newChat.save();

    res.status(201).json(newChat);
  } catch (error) {
    removeTempFile(req.file);
    res.status(500).json({ message: "Error sending message", error: errorPayload(error) });
  }
});

export default router;
