import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import mongoose from "mongoose";
import Product from "../models/Product.js";
import Section from "../models/Section.js";

const router = express.Router();

// ... (Keep existing storage/upload configuration as is) ...
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = 'uploads/';
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 5000000 }, 
  fileFilter: (req, file, cb) => {
    const filetypes = /jpeg|jpg|png|webp/;
    const mimetype = filetypes.test(file.mimetype);
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    if (mimetype && extname) {
      return cb(null, true);
    }
    cb(new Error('Only images are allowed'));
  }
});

const cpUpload = upload.fields([
  { name: 'image', maxCount: 1 }, 
  { name: 'extraImages', maxCount: 10 }
]);

// --- ROUTES ---

// ... (Keep GET routes as is) ...
router.get("/search", async (req, res) => {
    // ... (Keep existing code)
    try {
        const { q } = req.query;
        if (!q) return res.json([]);
        const fuzzy = q.split('').join('.*');
        const regex = new RegExp(fuzzy, 'i');
        const products = await Product.find({
          $or: [
            { title: { $regex: regex } },
            { description: { $regex: regex } },
            { title: { $regex: q, $options: 'i' } }
          ]
        }).populate('category', 'name').sort({ createdAt: -1 });
        res.json(products);
      } catch (error) {
        res.status(500).json({ message: "Error searching products", error: error.message });
      }
});

router.get("/", async (req, res) => {
    // ... (Keep existing code)
    try {
        const products = await Product.find({})
          .populate('category', 'name')
          .populate('section', 'name')
          .sort({ createdAt: -1 });
        res.json(products);
      } catch (error) {
        res.status(500).json({ message: "Error fetching products", error: error.message });
      }
});

// UPDATE: Added youtubeLink to POST
router.post("/", cpUpload, async (req, res) => {
  try {
    const { 
      title, description, price, optionalPrice, category, section, codAvailable, isAvailable,
      deliveryCharges, deliveryTimeMin, deliveryTimeMax, warranty, youtubeLink 
    } = req.body;
    
    if (!req.files || !req.files['image']) {
      return res.status(400).json({ message: "Cover Image is required" });
    }

    let sectionId = section;
    if (section && !mongoose.Types.ObjectId.isValid(section)) {
        const secDoc = await Section.findOne({ name: section });
        sectionId = secDoc ? secDoc._id : null;
    } else if (!section) {
        sectionId = null;
    }

    const imagePath = `/uploads/${req.files['image'][0].filename}`;
    
    let extraImagesPaths = [];
    if (req.files['extraImages']) {
      extraImagesPaths = req.files['extraImages'].map(file => `/uploads/${file.filename}`);
    }

    const product = new Product({
      title,
      description: description || '',
      price,
      optionalPrice: optionalPrice || null,
      youtubeLink: youtubeLink || '', // ADDED
      image: imagePath,
      extraImages: extraImagesPaths,
      category, 
      section: sectionId,
      codAvailable: codAvailable === undefined ? true : (codAvailable === 'true' || codAvailable === true),
      isAvailable: isAvailable === undefined ? true : (isAvailable === 'true' || isAvailable === true),
      deliveryCharges: deliveryCharges || 0,
      deliveryTimeMin: deliveryTimeMin || 3,
      deliveryTimeMax: deliveryTimeMax || 5,
      warranty: warranty || 0
    });

    const savedProduct = await product.save();
    res.status(201).json(savedProduct);
  } catch (error) {
    if (req.files) {
        // Cleanup uploads on error
      if (req.files['image']) fs.unlinkSync(req.files['image'][0].path);
      if (req.files['extraImages']) req.files['extraImages'].forEach(file => fs.unlinkSync(file.path));
    }
    console.error("Error in POST /api/products:", error);
    res.status(500).json({ message: "Error saving product", error: error.message });
  }
});

// UPDATE: Added youtubeLink to PUT
router.put("/:id", cpUpload, async (req, res) => {
  try {
    const { 
      title, description, price, optionalPrice, category, section, codAvailable, isAvailable,
      deliveryCharges, deliveryTimeMin, deliveryTimeMax, warranty, youtubeLink
    } = req.body;
    
    const product = await Product.findById(req.params.id);

    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    product.title = title || product.title;
    if (description !== undefined) product.description = description;
    product.price = price || product.price;
    product.optionalPrice = optionalPrice !== undefined ? optionalPrice : product.optionalPrice;
    product.category = category || product.category;
    
    // ADDED
    if (youtubeLink !== undefined) product.youtubeLink = youtubeLink;

    if (codAvailable !== undefined) product.codAvailable = codAvailable === 'true' || codAvailable === true;
    if (isAvailable !== undefined) product.isAvailable = isAvailable === 'true' || isAvailable === true;
    if (deliveryCharges !== undefined) product.deliveryCharges = deliveryCharges;
    if (deliveryTimeMin !== undefined) product.deliveryTimeMin = deliveryTimeMin;
    if (deliveryTimeMax !== undefined) product.deliveryTimeMax = deliveryTimeMax;
    if (warranty !== undefined) product.warranty = warranty;

    if (section !== undefined) {
        let sectionId = section;
        if (section && !mongoose.Types.ObjectId.isValid(section)) {
            const secDoc = await Section.findOne({ name: section });
            sectionId = secDoc ? secDoc._id : null;
        } else if (!section) {
            sectionId = null;
        }
        product.section = sectionId;
    }

    // Handle Cover Image Replacement
    if (req.files && req.files['image']) {
      const cleanPath = product.image.startsWith('/') ? product.image.substring(1) : product.image;
      const oldPath = path.resolve(cleanPath);
      // Delete old file
      if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
      product.image = `/uploads/${req.files['image'][0].filename}`;
    }

    // Handle Extra Images Addition (Appends to existing)
    if (req.files && req.files['extraImages']) {
      const newPaths = req.files['extraImages'].map(file => `/uploads/${file.filename}`);
      product.extraImages = [...product.extraImages, ...newPaths];
    }

    const updatedProduct = await product.save();
    res.json(updatedProduct);

  } catch (error) {
    console.error("Error in PUT /api/products:", error);
    res.status(500).json({ message: "Error updating product", error: error.message });
  }
});

// --- NEW ROUTE: DELETE SPECIFIC IMAGE ---
router.delete("/:id/images", async (req, res) => {
    try {
        const { imageUrl, type } = req.body; // type: 'cover' or 'extra'
        const product = await Product.findById(req.params.id);

        if (!product) return res.status(404).json({ message: "Product not found" });

        // Helper to remove file from FS
        const removeFile = (urlPath) => {
            const cleanPath = urlPath.startsWith('/') ? urlPath.substring(1) : urlPath;
            const fullPath = path.resolve(cleanPath);
            if (fs.existsSync(fullPath)) {
                fs.unlinkSync(fullPath);
            }
        };

        if (type === 'cover') {
            // Remove cover image
            if (product.image === imageUrl) {
                removeFile(imageUrl);
                product.image = ""; // Or reset to a placeholder if needed
            }
        } else if (type === 'extra') {
            // Remove from array
            if (product.extraImages.includes(imageUrl)) {
                removeFile(imageUrl);
                product.extraImages = product.extraImages.filter(img => img !== imageUrl);
            }
        }

        await product.save();
        res.json({ message: "Image removed successfully", product });

    } catch (error) {
        console.error("Error deleting image:", error);
        res.status(500).json({ message: "Error deleting image", error: error.message });
    }
});

// ... (Keep DELETE product route as is) ...
router.delete("/:id", async (req, res) => {
    // ... (Keep existing code)
    try {
        const product = await Product.findById(req.params.id);
        
        if (!product) {
          return res.status(404).json({ message: "Product not found" });
        }
    
        if (product.image) {
          const cleanPath = product.image.startsWith('/') ? product.image.substring(1) : product.image;
          const fullPath = path.resolve(cleanPath);
          if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
        }
    
        if (product.extraImages && product.extraImages.length > 0) {
          product.extraImages.forEach(img => {
            const cleanPath = img.startsWith('/') ? img.substring(1) : img;
            const fullPath = path.resolve(cleanPath);
            if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
          });
        }
    
        await Product.deleteOne({ _id: product._id });
        res.json({ message: "Product deleted" });
    
      } catch (error) {
        res.status(500).json({ message: "Error deleting product", error: error.message });
      }
});

export default router;