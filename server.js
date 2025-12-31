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
import warrantyRoutes from "./routes/warrantyRoutes.js ";  
import voucherRoutes from "./routes/voucherRoutes.js";
import adminAuthRoutes from "./routes/adminAuthRoutes.js";
import reviewRoutes from "./routes/reviewRoutes.js";

dotenv.config();
const app = express();

app.use(cors());
app.use(express.json());

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const uploadsPath = path.join(__dirname, 'uploads');

console.log(`Serving static files from: ${uploadsPath}`);

app.use('/uploads', express.static(uploadsPath));

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB connected"))
  .catch(err => console.error(err));
  
app.get("/", (req, res) => res.send("API running..."));



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

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));