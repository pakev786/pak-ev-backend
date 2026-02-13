import mongoose from "mongoose";

const loadFeaturedConfigSchema = mongoose.Schema({
  productIds: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: "Product"
  }]
}, {
  timestamps: true
});

const LoadFeaturedConfig = mongoose.model("LoadFeaturedConfig", loadFeaturedConfigSchema);

export default LoadFeaturedConfig;