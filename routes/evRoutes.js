import express from "express";
import EVCharger from "../models/EVCharger.js";
import EVBattery from "../models/EVBattery.js";
import EVKit from "../models/EVKit.js";
import EVBike from "../models/EVBike.js";
import EVRange from "../models/EVRange.js";
import EVFeaturedConfig from '../models/EVFeaturedConfig.js';
import Product from '../models/Product.js';
import LoadFeaturedConfig from '../models/LoadFeaturedConfig.js';

const router = express.Router();

router.get("/chargers", async (req, res) => res.json(await EVCharger.find()));
router.get("/batteries", async (req, res) => res.json(await EVBattery.find().populate('chargers')));
router.get("/kits", async (req, res) => res.json(await EVKit.find().populate({
    path: 'batteries',
    populate: { path: 'chargers' }
})));
router.get("/bikes", async (req, res) => res.json(await EVBike.find().populate({
    path: 'kits',
    populate: {
        path: 'batteries',
        populate: { path: 'chargers' }
    }
})));
router.get("/ranges", async (req, res) => res.json(await EVRange.find().populate('kit').populate('battery')));

router.post("/chargers", async (req, res) => {
    try { res.status(201).json(await new EVCharger(req.body).save()); } catch (e) { res.status(500).json(e); }
});
router.post("/batteries", async (req, res) => {
    try { res.status(201).json(await new EVBattery(req.body).save()); } catch (e) { res.status(500).json(e); }
});
router.post("/kits", async (req, res) => {
    try { res.status(201).json(await new EVKit(req.body).save()); } catch (e) { res.status(500).json(e); }
});
router.post("/bikes", async (req, res) => {
    try { res.status(201).json(await new EVBike(req.body).save()); } catch (e) { res.status(500).json(e); }
});
router.post("/ranges", async (req, res) => {
    try { res.status(201).json(await new EVRange(req.body).save()); } catch (e) { res.status(500).json(e); }
});

router.put("/chargers/:id", async (req, res) => {
    try { res.json(await EVCharger.findByIdAndUpdate(req.params.id, req.body, { new: true })); } catch (e) { res.status(500).json(e); }
});
router.put("/batteries/:id", async (req, res) => {
    try { res.json(await EVBattery.findByIdAndUpdate(req.params.id, req.body, { new: true })); } catch (e) { res.status(500).json(e); }
});
router.put("/kits/:id", async (req, res) => {
    try { res.json(await EVKit.findByIdAndUpdate(req.params.id, req.body, { new: true })); } catch (e) { res.status(500).json(e); }
});
router.put("/bikes/:id", async (req, res) => {
    try { res.json(await EVBike.findByIdAndUpdate(req.params.id, req.body, { new: true })); } catch (e) { res.status(500).json(e); }
});
router.put("/ranges/:id", async (req, res) => {
    try { res.json(await EVRange.findByIdAndUpdate(req.params.id, req.body, { new: true })); } catch (e) { res.status(500).json(e); }
});

router.delete("/chargers/:id", async (req, res) => { await EVCharger.findByIdAndDelete(req.params.id); res.json({ message: "Deleted" }); });
router.delete("/batteries/:id", async (req, res) => { await EVBattery.findByIdAndDelete(req.params.id); res.json({ message: "Deleted" }); });
router.delete("/kits/:id", async (req, res) => { await EVKit.findByIdAndDelete(req.params.id); res.json({ message: "Deleted" }); });
router.delete("/bikes/:id", async (req, res) => { await EVBike.findByIdAndDelete(req.params.id); res.json({ message: "Deleted" }); });
router.delete("/ranges/:id", async (req, res) => { await EVRange.findByIdAndDelete(req.params.id); res.json({ message: "Deleted" }); });





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
    console.error("Error fetching featured EV products:", error);
    res.status(500).json({ message: "Server Error" });
  }
});


router.post('/featured-products', async (req, res) => {
  const { productIds } = req.body;

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
    console.error("Error saving featured EV products:", error);
    res.status(500).json({ message: "Server Error" });
  }
});


router.get('/load-featured-products', async (req, res) => {
  try {
    const config = await LoadFeaturedConfig.findOne().populate('productIds');
    res.json(config ? config.productIds : []);
  } catch (error) {
    res.status(500).json({ message: "Server Error" });
  }
});

router.post('/load-featured-products', async (req, res) => {
  const { productIds } = req.body;
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
    res.status(500).json({ message: "Server Error" });
  }
});

export default router;