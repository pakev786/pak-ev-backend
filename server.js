import express from "express";
import dotenv from "dotenv";
import mongoose from "mongoose";
import cors from "cors";
import path from "path";
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import categoryRoutes from "./routes/categoryRoutes.js";
import sectionRoutes from "./routes/sectionRoutes.js";
import productRoutes from "./routes/productRoutes.js";
import bannerRoutes from "./routes/bannerRoutes.js";
import authRoutes from "./routes/authroutes.js";
import bankRoutes from "./routes/bankRoutes.js";
import settingRoutes from "./routes/settingRoutes.js";
import orderRoutes from "./routes/orderRoutes.js";
import chatRoutes from "./routes/chatRoutes.js";
import warrantyRoutes from "./routes/warrantyRoutes.js";
import voucherRoutes from "./routes/voucherRoutes.js";
import adminAuthRoutes from "./routes/adminAuthRoutes.js";
import reviewRoutes from "./routes/reviewRoutes.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load env vars
dotenv.config({ path: path.join(__dirname, '.env') });

const app = express();

// Configure CORS for production (Allow all for now, lock down later)
app.use(cors({
    origin: '*', 
    credentials: true 
}));

app.use(express.json());

// Debug log for email
console.log("------------------------------------------------");
if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
  console.log(`✅ Email Config Loaded: ${process.env.EMAIL_USER}`);
} else {
  console.warn("⚠️ Email Config MISSING. Check .env.");
}
console.log("------------------------------------------------");

const uploadsPath = path.join(__dirname, 'uploads');
// Ensure upload directory exists
import fs from 'fs';
if (!fs.existsSync(uploadsPath)){
    fs.mkdirSync(uploadsPath, { recursive: true });
}
app.use('/uploads', express.static(uploadsPath));

// MongoDB connection with retry logic
const connectDB = async () => {
    try {
        const conn = await mongoose.connect(process.env.MONGO_URI);
        console.log(`MongoDB Connected: ${conn.connection.host}`);
    } catch (error) {
        console.error(`Error: ${error.message}`);
        // Do not exit process, let Render restart it or try again
    }
};
connectDB();

app.get("/", (req, res) => res.send("API is running..."));

// Routes
app.use("/api/categories", categoryRoutes);
app.use("/api/sections", sectionRoutes);
app.use("/api/products", productRoutes);
app.use("/api/banners", bannerRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/banks", bankRoutes);
app.use("/api/settings", settingRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/warranties", warrantyRoutes);
app.use("/api/vouchers", voucherRoutes);
app.use("/api/admin", adminAuthRoutes);
app.use("/api/reviews", reviewRoutes);

// Use PORT from env or default to 5000
const PORT = process.env.PORT || 5000;

// Listen on 0.0.0.0 to be accessible externally (Required for Render)
app.listen(PORT, '0.0.0.0', () => console.log(`Server running on port ${PORT}`));