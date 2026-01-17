import express from "express";
import EVCharger from "../models/EVCharger.js";
import EVBattery from "../models/EVBattery.js";
import EVKit from "../models/EVKit.js";
import EVBike from "../models/EVBike.js";
import EVRange from "../models/EVRange.js";

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

export default router;