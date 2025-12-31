import mongoose from "mongoose";

// Simple key-value store for global settings
const settingSchema = mongoose.Schema({
  key: {
    type: String,
    required: true,
    unique: true
  },
  value: {
    type: String,
    default: ''
  }
});

const Setting = mongoose.model("Setting", settingSchema);

export default Setting;