import express from "express";
import { protectAdmin } from "../middleware/authMiddleware.js";
import multer from "multer";
import path from "path";
import fs from "fs";
import Banner from "../models/Banner.js";

const router = express.Router();

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = 'uploads/banners/';
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, `banner-${req.params.slot}-${uniqueSuffix}${path.extname(file.originalname)}`);
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 5000000 }, 
  fileFilter: (req, file, cb) => {
    const filetypes = /jpeg|jpg|png|webp/;
    const mimetype = filetypes.test(file.mimetype);
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    if (mimetype && extname) return cb(null, true);
    cb(new Error('Only images are allowed'));
  }
});

// GET: Fetch all banners
router.get("/", async (req, res) => {
  try {
    const banners = await Banner.find({});
    const bannerMap = {};
    banners.forEach(b => {
      bannerMap[b.slot] = b;
    });
    res.json(bannerMap);
  } catch (error) {
    res.status(500).json({ message: "Error fetching banners", error: process.env.NODE_ENV === 'production' ? 'Internal Server Error' : error.message });
  }
});

// POST: Update specific slot (Image + Link Data)
router.post("/:slot", protectAdmin, upload.single('image'), async (req, res) => {
  try {
    const { slot } = req.params;
    const { linkType, linkValue, title } = req.body;
    
    if (!['main', 'side1', 'side2', 'side3', 'side4'].includes(slot)) {
      return res.status(400).json({ message: "Invalid slot" });
    }
    
    // Construct update object
    const updateData = {
      slot,
      title: title || '',
      linkType: linkType || 'none',
      linkValue: linkValue || ''
    };

    // If new image uploaded, handle file logic
    if (req.file) {
      const imagePath = `/uploads/banners/${req.file.filename}`;
      updateData.image = imagePath;

      // Clean up old image
      const oldBanner = await Banner.findOne({ slot });
      if (oldBanner && oldBanner.image) {
        const cleanPath = oldBanner.image.startsWith('/') ? oldBanner.image.substring(1) : oldBanner.image;
        const oldPath = path.resolve(cleanPath);
        if (fs.existsSync(oldPath)) {
          fs.unlinkSync(oldPath);
        }
      }
    } else {
      // If no file, ensure we don't wipe existing image if it exists
      // However, if it's a new upsert and no image, it will fail schema validation if not handled.
      // But typically we require image on creation.
      // For updates without image, we just don't set image field.
    }

    const banner = await Banner.findOneAndUpdate(
      { slot },
      updateData,
      { new: true, upsert: true }
    );

    res.json(banner);

  } catch (error) {
    if (req.file) fs.unlinkSync(req.file.path);
    res.status(500).json({ message: "Error saving banner", error: process.env.NODE_ENV === 'production' ? 'Internal Server Error' : error.message });
  }
});

export default router;