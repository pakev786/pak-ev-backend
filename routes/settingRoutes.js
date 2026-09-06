import express from "express";
import { protectAdmin } from "../middleware/authMiddleware.js";
import Setting from "../models/Setting.js";
import { isNonEmptyString, isValidEmail, asString } from "../utils/validate.js";

const router = express.Router();

// GET: Fetch setting by key (generic handler if needed, but keeping specific for now)

// GET: WhatsApp
router.get("/whatsapp", async (req, res) => {
  try {
    const setting = await Setting.findOne({ key: 'whatsapp' });
    res.json({ number: setting ? setting.value : '' });
  } catch (error) {
    res.status(500).json({ message: "Error fetching setting", error: process.env.NODE_ENV === 'production' ? 'Internal Server Error' : error.message });
  }
});

// PUT: WhatsApp
router.put("/whatsapp", protectAdmin, async (req, res) => {
  try {
        const { number } = req.body;
    if (!isNonEmptyString(number) || !/^[+0-9 ()-]{5,20}$/.test(number.trim())) {
      return res.status(400).json({ message: "Invalid WhatsApp number" });
    }
    const setting = await Setting.findOneAndUpdate(
      { key: 'whatsapp' },
      { key: 'whatsapp', value: asString(number) },
      { new: true, upsert: true }
    );
    res.json({ number: setting.value });
  } catch (error) {
    res.status(500).json({ message: "Error updating setting", error: process.env.NODE_ENV === 'production' ? 'Internal Server Error' : error.message });
  }
});

// GET: Admin Email
router.get("/email", async (req, res) => {
  try {
    const setting = await Setting.findOne({ key: 'admin_email' });
    res.json({ email: setting ? setting.value : '' });
  } catch (error) {
    res.status(500).json({ message: "Error fetching email setting", error: process.env.NODE_ENV === 'production' ? 'Internal Server Error' : error.message });
  }
});

// PUT: Admin Email
router.put("/email", protectAdmin, async (req, res) => {
  try {
        const { email } = req.body;
    if (!isValidEmail(email)) {
      return res.status(400).json({ message: "Invalid email address" });
    }
    const setting = await Setting.findOneAndUpdate(
      { key: 'admin_email' },
      { key: 'admin_email', value: asString(email).toLowerCase() },
      { new: true, upsert: true }
    );
    res.json({ email: setting.value });
  } catch (error) {
    res.status(500).json({ message: "Error updating email setting", error: process.env.NODE_ENV === 'production' ? 'Internal Server Error' : error.message });
  }
});

export default router;