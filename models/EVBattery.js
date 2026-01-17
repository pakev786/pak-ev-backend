import mongoose from "mongoose";

const evBatterySchema = mongoose.Schema({
  name: { type: String, required: true },
  price: { type: Number, required: true },
  boxPrice: { type: Number, default: 0 },
  amperes: { type: Number, required: true, default: 0 },
  chargers: [{ type: mongoose.Schema.Types.ObjectId, ref: "EVCharger" }]
}, { timestamps: true });

evBatterySchema.set('toJSON', { 
  virtuals: true, 
  versionKey: false, 
  transform: (doc, ret) => { 
    ret.id = doc._id.toString(); 
  } 
});

export default mongoose.model("EVBattery", evBatterySchema);