import express from "express";
import { protectAdmin } from "../middleware/authMiddleware.js";
import Section from "../models/Section.js";
import { isNonEmptyString, isValidObjectId, asString } from "../utils/validate.js";

const router = express.Router();

// GET: Fetch all sections sorted by order
router.get("/", async (req, res) => {
  try {
    const sections = await Section.find({}).sort({ order: 1 });
    res.json(sections);
  } catch (error) {
    res.status(500).json({ message: "Error fetching sections", error: process.env.NODE_ENV === 'production' ? 'Internal Server Error' : error.message });
  }
});

// POST: Add a new section
router.post("/", protectAdmin, async (req, res) => {
  try {
        const { name, isMarquee } = req.body;
    if (!isNonEmptyString(name) || name.trim().length > 60) {
      return res.status(400).json({ message: "Name is required" });
    }

    const lastSection = await Section.findOne().sort({ order: -1 });
    const newOrder = lastSection && lastSection.order !== undefined ? lastSection.order + 1 : 0;

    const section = new Section({
      name: asString(name),
      isMarquee: isMarquee === true || isMarquee === 'true',
      order: newOrder
    });
    const savedSection = await section.save();

    res.status(201).json(savedSection);
  } catch (error) {
    res.status(500).json({ message: "Error creating section", error: process.env.NODE_ENV === 'production' ? 'Internal Server Error' : error.message });
  }
});

// PUT: Reorder sections
router.put("/reorder", protectAdmin, async (req, res) => {
  try {
    const { orderedIds } = req.body; 

        if (!Array.isArray(orderedIds) || orderedIds.length > 200 || !orderedIds.every(isValidObjectId)) {
      return res.status(400).json({ message: "Invalid data" });
    }

    const bulkOps = orderedIds.map((id, index) => ({
      updateOne: {
        filter: { _id: id },
        update: { order: index }
      }
    }));

    await Section.bulkWrite(bulkOps);

    res.json({ message: "Sections reordered successfully" });
  } catch (error) {
    res.status(500).json({ message: "Error reordering sections", error: process.env.NODE_ENV === 'production' ? 'Internal Server Error' : error.message });
  }
});

// PUT: Update a section
router.put("/:id", protectAdmin, async (req, res) => {
  try {
    const { name, isMarquee } = req.body;
    const { id } = req.params;

    if (!isValidObjectId(id)) return res.status(400).json({ message: "Invalid section id" });

    const updateData = {};
    if (name !== undefined) {
      if (!isNonEmptyString(name) || name.trim().length > 60) {
        return res.status(400).json({ message: "Invalid section name" });
      }
      updateData.name = asString(name);
    }
    if (isMarquee !== undefined) updateData.isMarquee = isMarquee === true || isMarquee === 'true';

    const updatedSection = await Section.findByIdAndUpdate(
      id,
      updateData,
      { new: true }
    );

    if (!updatedSection) return res.status(404).json({ message: "Section not found" });

    res.json(updatedSection);
  } catch (error) {
    res.status(500).json({ message: "Error updating section", error: process.env.NODE_ENV === 'production' ? 'Internal Server Error' : error.message });
  }
});

// DELETE: Remove a section
router.delete("/:id", protectAdmin, async (req, res) => {
  try {
        const { id } = req.params;
    if (!isValidObjectId(id)) return res.status(400).json({ message: "Invalid section id" });
    await Section.findByIdAndDelete(id);
    res.json({ message: "Section deleted successfully", id });
  } catch (error) {
    res.status(500).json({ message: "Error deleting section", error: process.env.NODE_ENV === 'production' ? 'Internal Server Error' : error.message });
  }
});

export default router;