import mongoose from "mongoose";

const voucherSchema = mongoose.Schema({
  code: {
    type: String,
    required: true,
    unique: true,
    uppercase: true,
    trim: true
  },
  discountType: {
    type: String,
    enum: ['fixed', 'percentage'],
    required: true
  },
  value: {
    type: Number,
    required: true
  },
  applicability: {
    type: String,
    enum: ['all', 'category', 'section'],
    default: 'all'
  },
  targetId: {
    type: String, // Category ID or Section ID if applicability is not 'all'
    default: null
  },
  minOrderValue: {
    type: Number,
    default: 0
  },
  isActive: {
    type: Boolean,
    default: true
  }
},{
  timestamps: true
});

voucherSchema.set('toJSON', {
  virtuals: true,
  versionKey: false,
  transform: function (doc, ret){
    ret.id = ret._id;
    delete ret._id;
  }
});

const Voucher = mongoose.model("Voucher", voucherSchema);

export default Voucher;