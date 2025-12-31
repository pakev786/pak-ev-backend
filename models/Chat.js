import mongoose from "mongoose";

const chatSchema = mongoose.Schema({
  sender: {
    type: String, // Stores User ID or "ADMIN"
    required: true
  },
  receiver: {
    type: String, // Stores User ID or "ADMIN"
    required: true
  },
  message: {
    type: String,
    required: true
  },
  read: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

const Chat = mongoose.model("Chat", chatSchema);

export default Chat;