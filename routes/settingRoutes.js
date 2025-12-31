import express from "express";
import Setting from "../models/Setting.js";

const router = express.Router();

// GET: Fetch setting by key (generic handler if needed, but keeping specific for now)

// GET: WhatsApp
router.get("/whatsapp", async (req, res) => {
  try {
    const setting = await Setting.findOne({ key: 'whatsapp' });
    res.json({ number: setting ? setting.value : '' });
  } catch (error) {
    res.status(500).json({ message: "Error fetching setting", error: error.message });
  }
});

// PUT: WhatsApp
router.put("/whatsapp", async (req, res) => {
  try {
    const { number } = req.body;
    const setting = await Setting.findOneAndUpdate(
      { key: 'whatsapp' },
      { key: 'whatsapp', value: number },
      { new: true, upsert: true }
    );
    res.json({ number: setting.value });
  } catch (error) {
    res.status(500).json({ message: "Error updating setting", error: error.message });
  }
});

// GET: Admin Email
router.get("/email", async (req, res) => {
  try {
    const setting = await Setting.findOne({ key: 'admin_email' });
    res.json({ email: setting ? setting.value : '' });
  } catch (error) {
    res.status(500).json({ message: "Error fetching email setting", error: error.message });
  }
});

// PUT: Admin Email
router.put("/email", async (req, res) => {
  try {
    const { email } = req.body;
    const setting = await Setting.findOneAndUpdate(
      { key: 'admin_email' },
      { key: 'admin_email', value: email },
      { new: true, upsert: true }
    );
    res.json({ email: setting.value });
  } catch (error) {
    res.status(500).json({ message: "Error updating email setting", error: error.message });
  }
});

export default router;