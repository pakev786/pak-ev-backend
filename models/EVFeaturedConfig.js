import mongoose from "mongoose";

const evFeaturedConfigSchema = mongoose.Schema({
  productIds: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: "Product"
  }]
}, {
  timestamps: true
});

const EVFeaturedConfig = mongoose.model("EVFeaturedConfig", evFeaturedConfigSchema);

export default EVFeaturedConfig;