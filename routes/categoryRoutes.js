import express from "express";
import Category from "../models/Category.js";

const router = express.Router();

// GET: Fetch all categories
router.get("/", async (req, res) => {
  try {
    const categories = await Category.find({}).sort({ _id: -1 }); 
    res.json(categories);
  } catch (error) {
    res.status(500).json({ message: "Error fetching categories", error: error.message });
  }
});

// POST: Add a new category
router.post("/", async (req, res) => {
  try {
    const { name, inNavbar } = req.body;

    if (!name) {
      return res.status(400).json({ message: "Category name is required" });
    }

    // Check duplicate name
    const existingCategory = await Category.findOne({ 
      name: { $regex: new RegExp(`^${name}$`, 'i') } 
    });

    if (existingCategory) {
      return res.status(400).json({ message: "Category already exists" });
    }

    // Check navbar limit if setting to true
    if (inNavbar) {
      const count = await Category.countDocuments({ inNavbar: true });
      if (count >= 3) {
        return res.status(400).json({ message: "Maximum 3 categories allowed in Navbar" });
      }
    }

    const category = new Category({ name, inNavbar: inNavbar || false });
    const savedCategory = await category.save();

    res.status(201).json(savedCategory);
  } catch (error) {
    res.status(500).json({ message: "Error saving category", error: error.message });
  }
});

// PUT: Update a category
router.put("/:id", async (req, res) => {
  try {
    const { name, inNavbar } = req.body;
    const { id } = req.params;

    const updateData = {};
    if (name) updateData.name = name;
    if (inNavbar !== undefined) updateData.inNavbar = inNavbar;

    // Check name duplicate if name is changing
    if (name) {
      const existingCategory = await Category.findOne({ 
        name: { $regex: new RegExp(`^${name}$`, 'i') },
        _id: { $ne: id } 
      });
      if (existingCategory) {
        return res.status(400).json({ message: "Category with this name already exists" });
      }
    }

    // Check navbar limit if setting to true
    if (inNavbar === true) {
      // Count others that are already in navbar
      const count = await Category.countDocuments({ inNavbar: true, _id: { $ne: id } });
      if (count >= 3) {
        return res.status(400).json({ message: "Maximum 3 categories allowed in Navbar" });
      }
    }

    const updatedCategory = await Category.findByIdAndUpdate(
      id,
      updateData,
      { new: true } 
    );

    if (!updatedCategory) {
      return res.status(404).json({ message: "Category not found" });
    }

    res.json(updatedCategory);
  } catch (error) {
    res.status(500).json({ message: "Error updating category", error: error.message });
  }
});

// DELETE: Remove a category
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const deletedCategory = await Category.findByIdAndDelete(id);

    if (!deletedCategory) {
      return res.status(404).json({ message: "Category not found" });
    }

    res.json({ message: "Category deleted successfully", id });
  } catch (error) {
    res.status(500).json({ message: "Error deleting category", error: error.message });
  }
});

export default router;