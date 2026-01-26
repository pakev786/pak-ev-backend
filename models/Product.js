import mongoose from "mongoose";

const productSchema = mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    default: ''
  },
  price: {
    type: Number,
    required: true
  },
  optionalPrice: {
    type: Number,
    default: null
  },
  // --- NEW FIELD ADDED HERE ---
  youtubeLink: {
    type: String,
    default: ''
  },
  // ----------------------------
  image: {
    type: String, 
    required: true
  },
  extraImages: {
    type: [String], 
    default: []
  },
  category: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Category",
    required: true
  },
  section: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Section",
    default: null
  },
  codAvailable: {
    type: Boolean,
    default: true
  },
  isAvailable: {
    type: Boolean,
    default: true
  },
  deliveryCharges: {
    type: Number,
    default: 0
  },
  deliveryTimeMin: {
    type: Number,
    default: 3
  },
  deliveryTimeMax: {
    type: Number,
    default: 5
  },
  warranty: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

productSchema.set('toJSON', {
  virtuals: true,
  versionKey: false,
  transform: function (doc, ret) {
    ret.id = ret._id;
    delete ret._id;
  }
});

const Product = mongoose.model("Product", productSchema);

export default Product;