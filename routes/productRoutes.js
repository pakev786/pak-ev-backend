import express from "express";
import mongoose from "mongoose";
import Product from "../models/Product.js";
import Section from "../models/Section.js";
import { protectAdmin, requirePermission } from "../middleware/authMiddleware.js";
import { createUploader } from "../utils/upload.js";
import { safeDeleteUpload, removeTempFile } from "../utils/paths.js";
import { isValidObjectId, isNonEmptyString, asString, escapeRegex, toFiniteNumber } from "../utils/validate.js";

const router = express.Router();

const errorPayload = (error) =>
  process.env.NODE_ENV === "production" ? "Internal Server Error" : error.message;

const upload = createUploader({ subDir: "", prefix: "image", maxFiles: 11 });

const cpUpload = upload.fields([
  { name: 'image', maxCount: 1 },
  { name: 'extraImages', maxCount: 10 }
]);

const cleanupUploads = (files) => {
  if (!files) return;
  Object.values(files).flat().forEach(removeTempFile);
};

// --- ROUTES ---

// ... (Keep GET routes as is) ...
router.get("/search", async (req, res) => {
    try {
        // req.query values can arrive as arrays (?q=a&q=b); only accept a string.
        const q = asString(req.query.q);
        if (!q) return res.json([]);

        // Cap the length: the "fuzzy" pattern below expands every character into
        // ".*", so a long query turns into a pathological regex that pins the
        // database CPU (ReDoS).
        const trimmed = q.slice(0, 60);
        const safeQ = escapeRegex(trimmed);
        const fuzzy = safeQ.split('').join('.*');
        const regex = new RegExp(fuzzy, 'i');

        const products = await Product.find({
          $or: [
            { title: { $regex: regex } },
            { description: { $regex: regex } },
            { title: { $regex: safeQ, $options: 'i' } }
          ]
        }).populate('category', 'name').sort({ createdAt: -1 }).limit(100);
        res.json(products);
      } catch (error) {
        res.status(500).json({ message: "Error searching products", error: errorPayload(error) });
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
        res.status(500).json({ message: "Error fetching products", error: errorPayload(error) });
      }
});

// UPDATE: Added youtubeLink to POST
router.post("/", protectAdmin, requirePermission("products"), cpUpload, async (req, res) => {
  try {
    const { 
      title, description, price, optionalPrice, category, section, codAvailable, isAvailable,
      deliveryCharges, deliveryTimeMin, deliveryTimeMax, warranty, youtubeLink 
    } = req.body;
    
        if (!req.files || !req.files['image']) {
      return res.status(400).json({ message: "Cover Image is required" });
    }

    if (!isNonEmptyString(title) || toFiniteNumber(price) === null || toFiniteNumber(price) < 0) {
      cleanupUploads(req.files);
      return res.status(400).json({ message: "Title and a valid price are required" });
    }

    if (!isValidObjectId(category)) {
      cleanupUploads(req.files);
      return res.status(400).json({ message: "A valid category is required" });
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
    cleanupUploads(req.files);
    console.error("Error in POST /api/products:", error.message);
    res.status(500).json({ message: "Error saving product", error: errorPayload(error) });
  }
});

// UPDATE: Added youtubeLink to PUT
router.put("/:id", protectAdmin, requirePermission("products"), cpUpload, async (req, res) => {
  try {
    const { 
      title, description, price, optionalPrice, category, section, codAvailable, isAvailable,
      deliveryCharges, deliveryTimeMin, deliveryTimeMax, warranty, youtubeLink
    } = req.body;
    
    if (!isValidObjectId(req.params.id)) {
      cleanupUploads(req.files);
      return res.status(400).json({ message: "Invalid product id" });
    }

    const product = await Product.findById(req.params.id);

    if (!product) {
      cleanupUploads(req.files);
      return res.status(404).json({ message: "Product not found" });
    }

    product.title = title || product.title;
    if (description !== undefined) product.description = description;
    product.price = price || product.price;
    product.optionalPrice = optionalPrice !== undefined ? optionalPrice : product.optionalPrice;
        if (category !== undefined) {
      if (!isValidObjectId(category)) {
        cleanupUploads(req.files);
        return res.status(400).json({ message: "Invalid category" });
      }
      product.category = category;
    }
    
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
      safeDeleteUpload(product.image);
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
    cleanupUploads(req.files);
    console.error("Error in PUT /api/products:", error.message);
    res.status(500).json({ message: "Error updating product", error: errorPayload(error) });
  }
});

// --- NEW ROUTE: DELETE SPECIFIC IMAGE ---
router.delete("/:id/images", protectAdmin, requirePermission("products"), async (req, res) => {
    try {
            const { imageUrl, type } = req.body; // type: 'cover' or 'extra'

    if (!isValidObjectId(req.params.id)) return res.status(400).json({ message: "Invalid product id" });
    if (!isNonEmptyString(imageUrl)) return res.status(400).json({ message: "imageUrl is required" });

    const product = await Product.findById(req.params.id);
        if (!product) return res.status(404).json({ message: "Product not found" });

        // Deletion is confined to the uploads directory by resolveUploadPath().
        const removeFile = (urlPath) => safeDeleteUpload(urlPath);

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
        console.error("Error deleting image:", error.message);
        res.status(500).json({ message: "Error deleting image", error: errorPayload(error) });
    }
});

// ... (Keep DELETE product route as is) ...
router.delete("/:id", protectAdmin, requirePermission("products"), async (req, res) => {
    // ... (Keep existing code)
    try {
            if (!isValidObjectId(req.params.id)) return res.status(400).json({ message: "Invalid product id" });

    const product = await Product.findById(req.params.id);

        if (!product) {
          return res.status(404).json({ message: "Product not found" });
        }
    
            const safeDeleteFile = (filePath) => safeDeleteUpload(filePath);

        if (product.image) safeDeleteFile(product.image);
    
        if (product.extraImages && product.extraImages.length > 0) {
          product.extraImages.forEach(img => safeDeleteFile(img));
        }
    
        await Product.deleteOne({ _id: product._id });
        res.json({ message: "Product deleted" });
    
      } catch (error) {
        res.status(500).json({ message: "Error deleting product", error: errorPayload(error) });
      }
});

export default router;