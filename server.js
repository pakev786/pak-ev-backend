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
import evRoutes from "./routes/evRoutes.js";
import branchRoutes from "./routes/branchRoutes.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: path.join(__dirname, '.env') });
const app = express();


const allowedOrigins = process.env.ALLOWED_ORIGINS 
  ? process.env.ALLOWED_ORIGINS.split(',') 
  : ['http://localhost:3000', 'http://127.0.0.1:3000'];

app.use(cors({
    origin: function(origin, callback) {
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
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


const connectDB = async () => {
    try {
        const conn = await mongoose.connect(process.env.MONGO_URI);
        console.log(`MongoDB Connected: ${conn.connection.host}`);
    } catch (error) {
        console.error(`Error: ${error.message}`);
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
app.use("/api/ev", evRoutes); 
app.use('/api/branches',branchRoutes);

// Use PORT from env or default to 5000
const PORT = process.env.PORT || 5000;

// Listen on 0.0.0.0 to be accessible externally (Required for Render)
app.listen(PORT, '0.0.0.0', () => console.log(`Server running on port ${PORT}`));