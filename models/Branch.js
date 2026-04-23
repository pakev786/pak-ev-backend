import mongoose from "mongoose";

const branchSchema = new mongoose.Schema({
  city: {
    type: String,
    required: true,
  },
  holder: {
    type: String,
    default: "",
  },
  phone: {
    type: String,
    required: true,
  },
  address: {
    type: String,
    default: "",
  }
}, { timestamps: true });

const Branch = mongoose.model("Branch", branchSchema);

export default Branch;