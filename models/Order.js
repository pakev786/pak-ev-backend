import mongoose from "mongoose";

const orderSchema = mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  products: [{
    product: { type: mongoose.Schema.Types.ObjectId, ref: "Product" },
    quantity: { type: Number, required: true },
    title: String, 
    price: Number 
  }],
  totalCost: {
    type: Number,
    required: true
  },
  onlinePaid: {
    type: Number,
    required: true
  },
  codAmount: {
    type: Number,
    default: 0
  },
  bankAccount: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "BankAccount",
    required: true
  },
  paymentScreenshot: {
    type: String,
    required: false 
  },
  deliveryTime: {
    type: Date,
    default: null
  },
  maxDeliveryDays: {
    type: Number,
    required: true
  },
  // New Fields
  shippingAddress: {
    type: String,
    required: true
  },
  contactNumber: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ['Non Verified', 'Verified', 'Delivered', 'Declined'],
    default: 'Non Verified'
  }
}, {
  timestamps: true
});

orderSchema.set('toJSON', {
  virtuals: true,
  versionKey: false,
  transform: function (doc, ret) {
    ret.id = ret._id;
    delete ret._id;
  }
});

const Order = mongoose.model("Order", orderSchema);

export default Order;