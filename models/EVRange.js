import mongoose from "mongoose";

const evRangeSchema = mongoose.Schema({
  kit: { type: mongoose.Schema.Types.ObjectId, ref: "EVKit", required: true },
  battery: { type: mongoose.Schema.Types.ObjectId, ref: "EVBattery", required: true },
  range: { type: String, required: true }
}, { timestamps: true });

evRangeSchema.set('toJSON', { 
  virtuals: true, 
  versionKey: false, 
  transform: (doc, ret) => { 
    ret.id = doc._id.toString(); 
  } 
});

export default mongoose.model("EVRange", evRangeSchema);