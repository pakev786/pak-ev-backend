import express from "express";
import EVCharger from "../models/EVCharger.js";
import EVBattery from "../models/EVBattery.js";
import EVKit from "../models/EVKit.js";
import EVBike from "../models/EVBike.js";
import EVRange from "../models/EVRange.js";
import EVFeaturedConfig from '../models/EVFeaturedConfig.js';
import Product from '../models/Product.js';
import LoadFeaturedConfig from '../models/LoadFeaturedConfig.js';
import { protectAdmin, requirePermission } from "../middleware/authMiddleware.js";
import { isValidObjectId } from "../utils/validate.js";

const router = express.Router();

const handleServerError = (res, error, message) => {
    res.status(500).json({ 
        message, 
        error: process.env.NODE_ENV === 'production' ? 'Internal Server Error' : error.message 
    });
};

const sendList = async (res, promise, message) => {
    try {
        res.json(await promise);
    } catch (error) {
        handleServerError(res, error, message);
    }
};

router.get("/chargers", async (req, res) => sendList(res, EVCharger.find(), "Error fetching chargers"));
router.get("/batteries", async (req, res) => sendList(res, EVBattery.find().populate('chargers'), "Error fetching batteries"));
router.get("/kits", async (req, res) => sendList(res, EVKit.find().populate({
    path: 'batteries',
    populate: { path: 'chargers' }
}), "Error fetching kits"));
router.get("/bikes", async (req, res) => sendList(res, EVBike.find().populate({
    path: 'kits',
    populate: {
        path: 'batteries',
        populate: { path: 'chargers' }
    }
}), "Error fetching bikes"));
router.get("/ranges", async (req, res) => sendList(res, EVRange.find().populate('kit').populate('battery'), "Error fetching ranges"));

const validateId = (req, res, next) => {
    if (!isValidObjectId(req.params.id)) return res.status(400).json({ message: "Invalid id" });
    next();
};

router.post("/chargers", protectAdmin, requirePermission("config"), async (req, res) => {
    try { res.status(201).json(await new EVCharger(req.body).save()); } catch (e) { handleServerError(res, e, "Error creating charger"); }
});
router.post("/batteries", protectAdmin, requirePermission("config"), async (req, res) => {
    try { res.status(201).json(await new EVBattery(req.body).save()); } catch (e) { handleServerError(res, e, "Error creating battery"); }
});
router.post("/kits", protectAdmin, requirePermission("config"), async (req, res) => {
    try { res.status(201).json(await new EVKit(req.body).save()); } catch (e) { handleServerError(res, e, "Error creating kit"); }
});
router.post("/bikes", protectAdmin, requirePermission("config"), async (req, res) => {
    try { res.status(201).json(await new EVBike(req.body).save()); } catch (e) { handleServerError(res, e, "Error creating bike"); }
});
router.post("/ranges", protectAdmin, requirePermission("config"), async (req, res) => {
    try { res.status(201).json(await new EVRange(req.body).save()); } catch (e) { handleServerError(res, e, "Error creating range"); }
});

router.put("/chargers/:id", protectAdmin, requirePermission("config"), validateId, async (req, res) => {
    try { res.json(await EVCharger.findByIdAndUpdate(req.params.id, req.body, { new: true })); } catch (e) { handleServerError(res, e, "Error updating charger"); }
});
router.put("/batteries/:id", protectAdmin, requirePermission("config"), validateId, async (req, res) => {
    try { res.json(await EVBattery.findByIdAndUpdate(req.params.id, req.body, { new: true })); } catch (e) { handleServerError(res, e, "Error updating battery"); }
});
router.put("/kits/:id", protectAdmin, requirePermission("config"), validateId, async (req, res) => {
    try { res.json(await EVKit.findByIdAndUpdate(req.params.id, req.body, { new: true })); } catch (e) { handleServerError(res, e, "Error updating kit"); }
});
router.put("/bikes/:id", protectAdmin, requirePermission("config"), validateId, async (req, res) => {
    try { res.json(await EVBike.findByIdAndUpdate(req.params.id, req.body, { new: true })); } catch (e) { handleServerError(res, e, "Error updating bike"); }
});
router.put("/ranges/:id", protectAdmin, requirePermission("config"), validateId, async (req, res) => {
    try { res.json(await EVRange.findByIdAndUpdate(req.params.id, req.body, { new: true })); } catch (e) { handleServerError(res, e, "Error updating range"); }
});

router.delete("/chargers/:id", protectAdmin, requirePermission("config"), validateId, async (req, res) => { 
    try { await EVCharger.findByIdAndDelete(req.params.id); res.json({ message: "Deleted" }); } catch (e) { handleServerError(res, e, "Error deleting charger"); }
});
router.delete("/batteries/:id", protectAdmin, requirePermission("config"), validateId, async (req, res) => { 
    try { await EVBattery.findByIdAndDelete(req.params.id); res.json({ message: "Deleted" }); } catch (e) { handleServerError(res, e, "Error deleting battery"); }
});
router.delete("/kits/:id", protectAdmin, requirePermission("config"), validateId, async (req, res) => { 
    try { await EVKit.findByIdAndDelete(req.params.id); res.json({ message: "Deleted" }); } catch (e) { handleServerError(res, e, "Error deleting kit"); }
});
router.delete("/bikes/:id", protectAdmin, requirePermission("config"), validateId, async (req, res) => { 
    try { await EVBike.findByIdAndDelete(req.params.id); res.json({ message: "Deleted" }); } catch (e) { handleServerError(res, e, "Error deleting bike"); }
});
router.delete("/ranges/:id", protectAdmin, requirePermission("config"), validateId, async (req, res) => { 
    try { await EVRange.findByIdAndDelete(req.params.id); res.json({ message: "Deleted" }); } catch (e) { handleServerError(res, e, "Error deleting range"); }
});

router.get('/featured-products', async (req, res) => {
  try {
    const config = await EVFeaturedConfig.findOne();

    if (!config || !config.productIds || config.productIds.length === 0) {
      return res.json([]);
    }

    const products = await Product.find({
      _id: { $in: config.productIds }
    }).select('title price image description category isAvailable codAvailable optionalPrice');

    res.json(products);
  } catch (error) {
    handleServerError(res, error, "Error fetching featured EV products");
  }
});


router.post('/featured-products', protectAdmin, requirePermission('config', 'showProducts'), async (req, res) => {
  const { productIds } = req.body;

  if (!Array.isArray(productIds) || productIds.length > 100 || !productIds.every(isValidObjectId)) {
    return res.status(400).json({ message: "Invalid product list" });
  }

  try {
    let config = await EVFeaturedConfig.findOne();

    if (config) {
      config.productIds = productIds;
      await config.save();
    } else {
      config = await EVFeaturedConfig.create({ productIds });
    }

    res.status(200).json({ message: "Featured products updated", config });
  } catch (error) {
    handleServerError(res, error, "Error saving featured EV products");
  }
});


router.get('/load-featured-products', async (req, res) => {
  try {
    const config = await LoadFeaturedConfig.findOne().populate('productIds');
    res.json(config ? config.productIds : []);
  } catch (error) {
    handleServerError(res, error, "Error loading featured products");
  }
});

router.post('/load-featured-products', protectAdmin, requirePermission('config', 'showProducts'), async (req, res) => {
  const { productIds } = req.body;

  if (!Array.isArray(productIds) || productIds.length > 100 || !productIds.every(isValidObjectId)) {
    return res.status(400).json({ message: "Invalid product list" });
  }

  try {
    let config = await LoadFeaturedConfig.findOne();
    if (config) {
      config.productIds = productIds;
      await config.save();
    } else {
      config = await LoadFeaturedConfig.create({ productIds });
    }
    res.status(200).json({ message: "Load Featured products updated", config });
  } catch (error) {
    handleServerError(res, error, "Error saving load featured products");
  }
});

export default router;