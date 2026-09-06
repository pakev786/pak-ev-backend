import express from "express";
import Admin from "../models/Admin.js";
import generateToken, { TOKEN_TYPES } from "../utils/generateToken.js";
import { protectAdmin, superAdminOnly } from "../middleware/authMiddleware.js";
import { rateLimit } from "../middleware/rateLimit.js";
import {
  isNonEmptyString,
  isAcceptablePassword,
  safeCompare,
  isValidObjectId,
  MIN_PASSWORD_LENGTH
} from "../utils/validate.js";

const router = express.Router();

const errorPayload = (error) =>
  process.env.NODE_ENV === "production" ? "Internal Server Error" : error.message;

const TOO_MANY = "Too many login attempts. Please try again in a few minutes.";

const adminLoginLimiter = [
  rateLimit({ name: "admin-login-ip", windowMs: 15 * 60 * 1000, max: 30, message: TOO_MANY }),
  rateLimit({
    name: "admin-login-account",
    windowMs: 15 * 60 * 1000,
    max: 8,
    message: TOO_MANY,
    keyGenerator: (req) => (typeof req.body?.username === "string" ? req.body.username.trim().toLowerCase() : "unknown")
  })
];

const ALLOWED_PERMISSIONS = [
  "stats",
  "categories",
  "products",
  "orders",
  "accounts",
  "support",
  "vouchers",
  "config",
  "showProducts",
  "branches"
];

/**
 * Bootstrap the first superadmin.
 *
 * This used to be an unauthenticated endpoint that created a "superAdmin"
 * account with the hard coded password "password123" — anyone who reached the
 * server before the owner did would own the dashboard. It now requires the
 * ADMIN_INIT_SECRET shared secret and a caller supplied password.
 */
router.post("/init", adminLoginLimiter, async (req, res) => {
  try {
    const initSecret = process.env.ADMIN_INIT_SECRET;
    if (!isNonEmptyString(initSecret) || initSecret.length < 16) {
      return res.status(503).json({ message: "Admin bootstrap is disabled" });
    }

    const providedSecret = req.get("x-init-secret");
    if (!isNonEmptyString(providedSecret) || !safeCompare(providedSecret, initSecret)) {
      return res.status(403).json({ message: "Invalid bootstrap secret" });
    }

    const count = await Admin.countDocuments();
    if (count > 0) return res.status(400).json({ message: "Admin already exists" });

    const { username, password } = req.body;
    if (!isNonEmptyString(username) || username.trim().length > 40) {
      return res.status(400).json({ message: "Username is required" });
    }
    if (!isAcceptablePassword(password)) {
      return res.status(400).json({ message: `Password must be at least ${MIN_PASSWORD_LENGTH} characters` });
    }

    const superAdmin = new Admin({
      username: username.trim(),
      password,
      role: "superadmin",
      permissions: ["all"]
    });
    await superAdmin.save();
    res.json({ message: "SuperAdmin created" });
  } catch (error) {
    res.status(500).json({ message: "Error init", error: errorPayload(error) });
  }
});

// POST: Admin Login
router.post("/login", adminLoginLimiter, async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!isNonEmptyString(username) || typeof password !== "string" || password.length === 0) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const admin = await Admin.findOne({ username: username.trim() });
    if (!admin || typeof admin.password !== "string") {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    let isMatch = false;
    if (admin.password.startsWith("$2a$") || admin.password.startsWith("$2b$") || admin.password.startsWith("$2y$")) {
      isMatch = await admin.matchPassword(password);
    } else {
      // Legacy plaintext record: constant time compare, then migrate to bcrypt.
      isMatch = safeCompare(admin.password, password);
      if (isMatch) {
        admin.password = password;
        await admin.save();
      }
    }

    if (!isMatch) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    if (admin.username === "superAdmin" && admin.role !== "superadmin") {
      admin.role = "superadmin";
      await admin.save();
    }

    res.json({
      id: admin.id,
      username: admin.username,
      role: admin.role,
      permissions: admin.permissions,
      token: generateToken(admin._id, TOKEN_TYPES.ADMIN)
    });
  } catch (error) {
    res.status(500).json({ message: "Login failed", error: errorPayload(error) });
  }
});

// GET: Fetch all admins (SuperAdmin only)
router.get("/", protectAdmin, superAdminOnly, async (req, res) => {
  try {
    const admins = await Admin.find({ role: { $ne: "superadmin" } }).select("-password");
    res.json(admins);
  } catch (error) {
    res.status(500).json({ message: "Error fetching admins", error: errorPayload(error) });
  }
});

// POST: Create new Admin (SuperAdmin only)
router.post("/create", protectAdmin, superAdminOnly, async (req, res) => {
  try {
    const { username, password, permissions } = req.body;

    if (!isNonEmptyString(username) || username.trim().length > 40) {
      return res.status(400).json({ message: "Username is required" });
    }
    if (!isAcceptablePassword(password)) {
      return res.status(400).json({ message: `Password must be at least ${MIN_PASSWORD_LENGTH} characters` });
    }

    const requested = Array.isArray(permissions) ? permissions : [];
    const invalid = requested.filter((p) => !ALLOWED_PERMISSIONS.includes(p));
    if (invalid.length > 0) {
      return res.status(400).json({ message: `Unknown permission(s): ${invalid.join(", ")}` });
    }

    const existing = await Admin.findOne({ username: username.trim() });
    if (existing) return res.status(400).json({ message: "Username exists" });

    const newAdmin = new Admin({
      username: username.trim(),
      password,
      role: "admin", // never accept the role from the request body
      permissions: requested
    });

    await newAdmin.save();
    res.status(201).json({
      id: newAdmin.id,
      username: newAdmin.username,
      role: newAdmin.role,
      permissions: newAdmin.permissions
    });
  } catch (error) {
    res.status(500).json({ message: "Error creating admin", error: errorPayload(error) });
  }
});

// DELETE: Remove Admin
router.delete("/:id", protectAdmin, superAdminOnly, async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) return res.status(400).json({ message: "Invalid admin id" });

    const target = await Admin.findById(id);
    if (!target) return res.status(404).json({ message: "Admin not found" });
    if (target.role === "superadmin") {
      return res.status(400).json({ message: "The superadmin account cannot be deleted" });
    }

    await Admin.deleteOne({ _id: target._id });
    res.json({ message: "Admin deleted" });
  } catch (error) {
    res.status(500).json({ message: "Error deleting admin", error: errorPayload(error) });
  }
});

// PUT: Update SuperAdmin Password
router.put("/superadmin/password", protectAdmin, superAdminOnly, async (req, res) => {
  try {
    const { password } = req.body;
    if (!isAcceptablePassword(password)) {
      return res.status(400).json({ message: `Password must be at least ${MIN_PASSWORD_LENGTH} characters` });
    }

    // Only ever change the password of the account that is signed in.
    const superAdmin = await Admin.findById(req.admin._id);
    if (!superAdmin) {
      return res.status(404).json({ message: "Superadmin not found" });
    }
    superAdmin.password = password;
    await superAdmin.save(); // triggers pre('save') hook to hash password
    res.json({ message: "Password updated" });
  } catch (error) {
    res.status(500).json({ message: "Error updating password", error: errorPayload(error) });
  }
});

export default router;
