import express from "express";
import { protectAdmin, requirePermission } from "../middleware/authMiddleware.js";
import Branch from "../models/Branch.js";
import { isValidObjectId } from "../utils/validate.js";

const router = express.Router();

// GET all branches (Public)
router.get('/', async (req, res) => {
  try {
    const branches = await Branch.find();
    res.status(200).json(branches);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching branches', error: process.env.NODE_ENV === 'production' ? 'Internal Server Error' : error.message });
  }
});

// POST a new branch (Admin)
router.post('/', protectAdmin, requirePermission('branches'), async (req, res) => {
  try {
    const { city, holder, phone, address } = req.body;
    const newBranch = new Branch({ city, holder, phone, address });
    const savedBranch = await newBranch.save();
    res.status(201).json(savedBranch);
  } catch (error) {
    res.status(500).json({ message: 'Error creating branch', error: process.env.NODE_ENV === 'production' ? 'Internal Server Error' : error.message });
  }
});

// PUT update a branch (Admin)
router.put('/:id', protectAdmin, requirePermission('branches'), async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) return res.status(400).json({ message: 'Invalid branch id' });

    const { city, holder, phone, address } = req.body;
    const update = {};
    if (city !== undefined) update.city = city;
    if (holder !== undefined) update.holder = holder;
    if (phone !== undefined) update.phone = phone;
    if (address !== undefined) update.address = address;

    const updatedBranch = await Branch.findByIdAndUpdate(
      req.params.id,
      update,
      { new: true, runValidators: true }
    );
    res.status(200).json(updatedBranch);
  } catch (error) {
    res.status(500).json({ message: 'Error updating branch', error: process.env.NODE_ENV === 'production' ? 'Internal Server Error' : error.message });
  }
});

// DELETE a branch (Admin)
router.delete('/:id', protectAdmin, requirePermission('branches'), async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) return res.status(400).json({ message: 'Invalid branch id' });
    await Branch.findByIdAndDelete(req.params.id);
    res.status(200).json({ message: 'Branch deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting branch', error: process.env.NODE_ENV === 'production' ? 'Internal Server Error' : error.message });
  }
});

export default router;