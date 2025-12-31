import express from "express";
import Section from "../models/Section.js";

const router = express.Router();

// GET: Fetch all sections sorted by order
router.get("/", async (req, res) => {
  try {
    const sections = await Section.find({}).sort({ order: 1 });
    res.json(sections);
  } catch (error) {
    res.status(500).json({ message: "Error fetching sections", error: error.message });
  }
});

// POST: Add a new section
router.post("/", async (req, res) => {
  try {
    const { name, isMarquee } = req.body;
    if (!name) return res.status(400).json({ message: "Name is required" });

    const lastSection = await Section.findOne().sort({ order: -1 });
    const newOrder = lastSection && lastSection.order !== undefined ? lastSection.order + 1 : 0;

    const section = new Section({ 
      name, 
      isMarquee: isMarquee || false,
      order: newOrder 
    });
    const savedSection = await section.save();

    res.status(201).json(savedSection);
  } catch (error) {
    res.status(500).json({ message: "Error creating section", error: error.message });
  }
});

// PUT: Reorder sections
router.put("/reorder", async (req, res) => {
  try {
    const { orderedIds } = req.body; 

    if (!orderedIds || !Array.isArray(orderedIds)) {
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
    res.status(500).json({ message: "Error reordering sections", error: error.message });
  }
});

// PUT: Update a section
router.put("/:id", async (req, res) => {
  try {
    const { name, isMarquee } = req.body;
    const { id } = req.params;

    const updateData = {};
    if (name) updateData.name = name;
    if (isMarquee !== undefined) updateData.isMarquee = isMarquee;

    const updatedSection = await Section.findByIdAndUpdate(
      id,
      updateData,
      { new: true }
    );

    if (!updatedSection) return res.status(404).json({ message: "Section not found" });

    res.json(updatedSection);
  } catch (error) {
    res.status(500).json({ message: "Error updating section", error: error.message });
  }
});

// DELETE: Remove a section
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    await Section.findByIdAndDelete(id);
    res.json({ message: "Section deleted successfully", id });
  } catch (error) {
    res.status(500).json({ message: "Error deleting section", error: error.message });
  }
});

export default router;