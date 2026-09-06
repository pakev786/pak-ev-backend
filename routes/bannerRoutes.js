import express from "express";
import { protectAdmin } from "../middleware/authMiddleware.js";
import Banner from "../models/Banner.js";
import { createUploader } from "../utils/upload.js";
import { safeDeleteUpload, removeTempFile } from "../utils/paths.js";
import { asString } from "../utils/validate.js";

const router = express.Router();

const VALID_SLOTS = ["main", "side1", "side2", "side3", "side4"];

const errorPayload = (error) =>
  process.env.NODE_ENV === "production" ? "Internal Server Error" : error.message;

const upload = createUploader({ subDir: "banners", prefix: "banner", maxFiles: 1 });

/**
 * The slot used to be interpolated straight into the stored filename, so a
 * request to /api/banners/..%2F..%2Fevil wrote the upload outside the uploads
 * directory. Validate it before multer ever touches the request.
 */
const validateSlot = (req, res, next) => {
  if (!VALID_SLOTS.includes(req.params.slot)) {
    return res.status(400).json({ message: "Invalid slot" });
  }
  next();
};

// GET: Fetch all banners
router.get("/", async (req, res) => {
  try {
    const banners = await Banner.find({});
    const bannerMap = {};
    banners.forEach((b) => {
      bannerMap[b.slot] = b;
    });
    res.json(bannerMap);
  } catch (error) {
    res.status(500).json({ message: "Error fetching banners", error: errorPayload(error) });
  }
});

// POST: Update specific slot (Image + Link Data)
router.post("/:slot", protectAdmin, validateSlot, upload.single("image"), async (req, res) => {
  try {
    const { slot } = req.params;
    const { linkType, linkValue, title } = req.body;

    const updateData = {
      slot,
      title: asString(title).slice(0, 200),
      linkType: asString(linkType) || "none",
      linkValue: asString(linkValue).slice(0, 500)
    };

    if (req.file) {
      updateData.image = `/uploads/banners/${req.file.filename}`;

      const oldBanner = await Banner.findOne({ slot });
      if (oldBanner && oldBanner.image) {
        safeDeleteUpload(oldBanner.image);
      }
    }

    const banner = await Banner.findOneAndUpdate({ slot }, updateData, { new: true, upsert: true });

    res.json(banner);
  } catch (error) {
    removeTempFile(req.file);
    res.status(500).json({ message: "Error saving banner", error: errorPayload(error) });
  }
});

export default router;
