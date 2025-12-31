import express from "express";
import Admin from "../models/Admin.js";

const router = express.Router();

// Initialize SuperAdmin (Run once or check on start)
// For simplicity, we expose a route to create the FIRST superadmin if none exists
router.post("/init", async (req, res) => {
  try {
    const count = await Admin.countDocuments();
    if (count > 0) return res.status(400).json({ message: "Admin already exists" });

    const superAdmin = new Admin({
      username: "superAdmin",
      password: "password123", // Default, change immediately
      role: "superadmin",
      permissions: ['all'] 
    });
    await superAdmin.save();
    res.json({ message: "SuperAdmin created" });
  } catch (error) {
    res.status(500).json({ message: "Error init", error: error.message });
  }
});

// POST: Admin Login
router.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    const admin = await Admin.findOne({ username });

    if (!admin || admin.password !== password) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    // In a real app, use JWT. Here sending user object for localStorage
    res.json({
      id: admin.id,
      username: admin.username,
      role: admin.role,
      permissions: admin.permissions
    });
  } catch (error) {
    res.status(500).json({ message: "Login failed", error: error.message });
  }
});

// GET: Fetch all admins (SuperAdmin only)
router.get("/", async (req, res) => {
  try {
    const admins = await Admin.find({ role: { $ne: 'superadmin' } });
    res.json(admins);
  } catch (error) {
    res.status(500).json({ message: "Error fetching admins", error: error.message });
  }
});

// POST: Create new Admin (SuperAdmin only)
router.post("/create", async (req, res) => {
  try {
    const { username, password, permissions } = req.body;
    
    const existing = await Admin.findOne({ username });
    if (existing) return res.status(400).json({ message: "Username exists" });

    const newAdmin = new Admin({
      username,
      password,
      role: 'admin',
      permissions
    });
    
    await newAdmin.save();
    res.status(201).json(newAdmin);
  } catch (error) {
    res.status(500).json({ message: "Error creating admin", error: error.message });
  }
});

// DELETE: Remove Admin
router.delete("/:id", async (req, res) => {
  try {
    await Admin.findByIdAndDelete(req.params.id);
    res.json({ message: "Admin deleted" });
  } catch (error) {
    res.status(500).json({ message: "Error deleting admin", error: error.message });
  }
});

// PUT: Update SuperAdmin Password
router.put("/superadmin/password", async (req, res) => {
  try {
    const { password } = req.body;
    await Admin.findOneAndUpdate({ role: 'superadmin' }, { password });
    res.json({ message: "Password updated" });
  } catch (error) {
    res.status(500).json({ message: "Error updating password", error: error.message });
  }
});

export default router;