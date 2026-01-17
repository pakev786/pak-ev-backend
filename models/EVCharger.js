import mongoose from "mongoose";

const evChargerSchema = mongoose.Schema({
  name: { type: String, required: true },
  price: { type: Number, required: true },
  amperes: { type: Number, required: true, default: 0 }
}, { timestamps: true });

evChargerSchema.set('toJSON', { 
  virtuals: true, 
  versionKey: false, 
  transform: (doc, ret) => { 
    ret.id = doc._id.toString(); 
  } 
});

export default mongoose.model("EVCharger", evChargerSchema);