import express from "express";
import dotenv from "dotenv";
import mongoose from "mongoose";
import cors from "cors";
import path from "path";
import multer from "multer";
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
import { sanitizeRequest } from "./middleware/sanitize.js";
import { rateLimit } from "./middleware/rateLimit.js";
import { UPLOADS_ROOT, ensureDir } from "./utils/paths.js";
import { getJwtSecret } from "./utils/generateToken.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: path.join(__dirname, '.env') });

// --- Fail fast on missing/insecure configuration -------------------------
// A hard coded fallback secret would let anyone reading this repository mint
// valid admin tokens, so refuse to boot without a real one.
try {
    getJwtSecret();
} catch (error) {
    console.error(`❌ ${error.message}`);
    process.exit(1);
}

if (!process.env.MONGO_URI) {
    console.error("❌ MONGO_URI is not set. Refusing to start.");
    process.exit(1);
}

const app = express();

// Render/Vercel style deployments sit behind a proxy; needed for correct
// client IPs in the rate limiter.
app.set('trust proxy', 1);
app.disable('x-powered-by');

const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim()).filter(Boolean)
  : ['http://localhost:3000', 'http://127.0.0.1:3000'];

if (allowedOrigins.includes('*')) {
    console.warn("⚠️ ALLOWED_ORIGINS contains '*'; wildcard origins are ignored because credentialed CORS requires an explicit origin list.");
}

app.use(cors({
    origin: function (origin, callback) {
        // Requests with no Origin header (curl, mobile apps, server to server).
        if (!origin) return callback(null, true);

        if (allowedOrigins.includes(origin)) {
            return callback(null, true);
        }
        console.error(`❌ CORS blocked origin: ${origin}. Add this to ALLOWED_ORIGINS env var.`);
        return callback(null, false);
    },
    credentials: true
}));

// Basic security headers (helmet equivalent for the handful that matter here).
app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
    if (process.env.NODE_ENV === 'production') {
        res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    }
    next();
});

// Cap request bodies so a single request cannot exhaust memory.
app.use(express.json({ limit: '200kb' }));
app.use(express.urlencoded({ extended: false, limit: '200kb' }));

// Strip MongoDB operators ($ne, $gt, ...) from user supplied payloads.
app.use(sanitizeRequest);

// Blanket limiter; the auth routes add tighter limits of their own.
app.use('/api', rateLimit({ name: 'global', windowMs: 60 * 1000, max: 300 }));

// Debug log for email
console.log("------------------------------------------------");
if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
  console.log(`✅ Email Config Loaded: ${process.env.EMAIL_USER}`);
} else {
  console.warn("⚠️ Email Config MISSING. Check .env.");
}
console.log("------------------------------------------------");

ensureDir(UPLOADS_ROOT);

// Uploaded files are user supplied content. Serve them with sniffing disabled
// and force anything that is not a known-inline image to download, so a stored
// file can never execute as HTML/SVG/JS on this origin.
const INLINE_TYPES = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif', '.pdf']);

app.use('/uploads', express.static(UPLOADS_ROOT, {
    index: false,
    dotfiles: 'deny',
    setHeaders: (res, filePath) => {
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('Content-Security-Policy', "default-src 'none'; img-src 'self'; object-src 'none'; sandbox");
        if (!INLINE_TYPES.has(path.extname(filePath).toLowerCase())) {
            res.setHeader('Content-Disposition', 'attachment');
        }
    }
}));

const connectDB = async () => {
    try {
        const conn = await mongoose.connect(process.env.MONGO_URI);
        console.log(`MongoDB Connected: ${conn.connection.host}`);
    } catch (error) {
        console.error(`Error: ${error.message}`);
        process.exit(1);
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
app.use('/api/branches', branchRoutes);

// 404 for unknown API routes
app.use('/api', (req, res) => res.status(404).json({ message: "Not found" }));

// Central error handler: never leak stack traces to clients.
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
    if (err instanceof multer.MulterError) {
        const message = err.code === 'LIMIT_FILE_SIZE'
            ? 'File is too large (max 5MB)'
            : 'Invalid file upload';
        return res.status(400).json({ message });
    }

    if (err && err.message === 'Not allowed by CORS') {
        return res.status(403).json({ message: 'Origin not allowed' });
    }

    // Rejections raised by the upload fileFilter are user errors, not bugs.
    if (err && /^Only images( and PDFs)? are allowed$|^Unsupported file type$/.test(err.message || '')) {
        return res.status(400).json({ message: err.message });
    }

    console.error('Unhandled error:', err?.message);
    const status = err?.status || err?.statusCode || 500;
    const isClientError = status >= 400 && status < 500;
    res.status(status).json({
        message: isClientError && err?.message ? err.message : 'Internal Server Error'
    });
});

// Use PORT from env or default to 5000
const PORT = process.env.PORT || 5000;

// Listen on 0.0.0.0 to be accessible externally (Required for Render)
app.listen(PORT, '0.0.0.0', () => console.log(`Server running on port ${PORT}`));
