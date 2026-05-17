import express from "express";
import Admin from "../models/Admin.js";
import generateToken from "../utils/generateToken.js";
import { protectAdmin, superAdminOnly } from "../middleware/authMiddleware.js";

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
    res.status(500).json({ message: "Error init", error: process.env.NODE_ENV === 'production' ? 'Internal Server Error' : error.message });
  }
});

// POST: Admin Login
router.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    const admin = await Admin.findOne({ username });

    if (!admin) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    // Check if password matches (either hashed or legacy plaintext)
    let isMatch = false;
    if (admin.password.startsWith('$2a$') || admin.password.startsWith('$2b$')) {
        // It's a hash
        isMatch = await admin.matchPassword(password);
    } else {
        // It's legacy plaintext
        isMatch = admin.password === password;
        if (isMatch) {
            // Migrate to hash for next time
            admin.password = password;
            await admin.save();
        }
    }

    if (!isMatch) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    // Migration: If this is the 'superAdmin' account and role is not set, set it
    if (admin.username === 'superAdmin' && admin.role !== 'superadmin') {
        admin.role = 'superadmin';
        await admin.save();
    }

    res.json({
      id: admin.id,
      username: admin.username,
      role: admin.role,
      permissions: admin.permissions,
      token: generateToken(admin._id)
    });
  } catch (error) {
    res.status(500).json({ message: "Login failed", error: process.env.NODE_ENV === 'production' ? 'Internal Server Error' : error.message });
  }
});

// GET: Fetch all admins (SuperAdmin only)
router.get("/", protectAdmin, superAdminOnly, async (req, res) => {
  try {
    const admins = await Admin.find({ role: { $ne: 'superadmin' } });
    res.json(admins);
  } catch (error) {
    res.status(500).json({ message: "Error fetching admins", error: process.env.NODE_ENV === 'production' ? 'Internal Server Error' : error.message });
  }
});

// POST: Create new Admin (SuperAdmin only)
router.post("/create", protectAdmin, superAdminOnly, async (req, res) => {
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
    res.status(201).json({
        id: newAdmin.id,
        username: newAdmin.username,
        role: newAdmin.role,
        permissions: newAdmin.permissions
    });
  } catch (error) {
    res.status(500).json({ message: "Error creating admin", error: process.env.NODE_ENV === 'production' ? 'Internal Server Error' : error.message });
  }
});

// DELETE: Remove Admin
router.delete("/:id", protectAdmin, superAdminOnly, async (req, res) => {
  try {
    await Admin.findByIdAndDelete(req.params.id);
    res.json({ message: "Admin deleted" });
  } catch (error) {
    res.status(500).json({ message: "Error deleting admin", error: process.env.NODE_ENV === 'production' ? 'Internal Server Error' : error.message });
  }
});

// PUT: Update SuperAdmin Password
router.put("/superadmin/password", protectAdmin, superAdminOnly, async (req, res) => {
  try {
    const { password } = req.body;
    const superAdmin = await Admin.findOne({ role: 'superadmin' });
    if (!superAdmin) {
        return res.status(404).json({ message: "Superadmin not found" });
    }
    superAdmin.password = password;
    await superAdmin.save(); // triggers pre('save') hook to hash password
    res.json({ message: "Password updated" });
  } catch (error) {
    res.status(500).json({ message: "Error updating password", error: process.env.NODE_ENV === 'production' ? 'Internal Server Error' : error.message });
  }
});

export default router;