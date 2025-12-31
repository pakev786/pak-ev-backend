import express from "express";
import Chat from "../models/Chat.js";
import User from "../models/User.js";

const router = express.Router();

router.get("/users", async (req, res) => {
  try {
    const senderIds = await Chat.distinct("sender", { receiver: "ADMIN" });
    const receiverIds = await Chat.distinct("receiver", { sender: "ADMIN" });
    const userIds = [...new Set([...senderIds, ...receiverIds])];
    const users = await User.find({ _id: { $in: userIds } }).select('name email phone');
    
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: "Error fetching chat users", error: error.message });
  }
});

router.get("/:userId", async (req, res) => {
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
    res.status(500).json({ message: "Error fetching messages", error: error.message });
  }
});

// POST: Send a message
router.post("/", async (req, res) => {
  try {
    const { sender, receiver, message } = req.body;
    
    if (!message || !sender || !receiver) {
      return res.status(400).json({ message: "Missing fields" });
    }

    const newChat = new Chat({ sender, receiver, message });
    await newChat.save();
    
    res.status(201).json(newChat);
  } catch (error) {
    res.status(500).json({ message: "Error sending message", error: error.message });
  }
});

export default router;