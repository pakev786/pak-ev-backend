import mongoose from "mongoose";

const bankAccountSchema = mongoose.Schema({
  bankName: {
    type: String,
    required: true,
    trim: true
  },
  accountHolderName: {
    type: String,
    required: true,
    trim: true
  },
  accountNumber: {
    type: String,
    required: true,
    trim: true
  },
  iban: {
    type: String,
    trim: true,
    default: ''
  }
}, {
  timestamps: true
});

bankAccountSchema.set('toJSON', {
  virtuals: true,
  versionKey: false,
  transform: function (doc, ret) {
    ret.id = ret._id;
    delete ret._id;
  }
});

const BankAccount = mongoose.model("BankAccount", bankAccountSchema);

export default BankAccount;