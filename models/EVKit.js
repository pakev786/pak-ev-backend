import mongoose from "mongoose";

const evKitSchema = mongoose.Schema({
  name: { type: String, required: true },
  price: { type: Number, required: true },
  fittingCost: { type: Number, default: 0 },
  topSpeed: { type: String, required: true, default: "0" },
  batteries: [{ type: mongoose.Schema.Types.ObjectId, ref: "EVBattery" }]
}, { timestamps: true });

evKitSchema.set('toJSON', { 
  virtuals: true, 
  versionKey: false, 
  transform: (doc, ret) => { 
    ret.id = doc._id.toString(); 
  } 
});

export default mongoose.model("EVKit", evKitSchema);