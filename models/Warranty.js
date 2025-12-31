import mongoose from "mongoose";

const warrantySchema = mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Product",
    required: true
  },
  productName: { // Snapshot of name for easier display
    type: String,
    required: true
  },
  quantity: {
    type: Number,
    required: true
  },
  validUntil: {
    type: Date,
    required: true
  },
  orderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Order"
  }
}, {
  timestamps: true
});

// Transform _id to id
warrantySchema.set('toJSON', {
  virtuals: true,
  versionKey: false,
  transform: function (doc, ret) {
    ret.id = ret._id;
    delete ret._id;
  }
});

const Warranty = mongoose.model("Warranty", warrantySchema);

export default Warranty;