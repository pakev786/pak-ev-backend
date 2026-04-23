import express from "express";
import Branch from "../models/Branch.js";

const router = express.Router();

// GET all branches (Public)
router.get('/', async (req, res) => {
  try {
    const branches = await Branch.find();
    res.status(200).json(branches);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching branches', error: error.message });
  }
});

// POST a new branch (Admin)
router.post('/', async (req, res) => {
  try {
    const newBranch = new Branch(req.body);
    const savedBranch = await newBranch.save();
    res.status(201).json(savedBranch);
  } catch (error) {
    res.status(500).json({ message: 'Error creating branch', error: error.message });
  }
});

// PUT update a branch (Admin)
router.put('/:id', async (req, res) => {
  try {
    const updatedBranch = await Branch.findByIdAndUpdate(
      req.params.id, 
      req.body, 
      { new: true }
    );
    res.status(200).json(updatedBranch);
  } catch (error) {
    res.status(500).json({ message: 'Error updating branch', error: error.message });
  }
});

// DELETE a branch (Admin)
router.delete('/:id', async (req, res) => {
  try {
    await Branch.findByIdAndDelete(req.params.id);
    res.status(200).json({ message: 'Branch deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting branch', error: error.message });
  }
});

export default router;