import mongoose from "mongoose";

const evBikeSchema = mongoose.Schema({
  name: { type: String, required: true },
  kits: [{ type: mongoose.Schema.Types.ObjectId, ref: "EVKit" }]
}, { timestamps: true });

evBikeSchema.set('toJSON', { 
  virtuals: true, 
  versionKey: false, 
  transform: (doc, ret) => { 
    ret.id = doc._id.toString(); 
  } 
});

export default mongoose.model("EVBike", evBikeSchema);