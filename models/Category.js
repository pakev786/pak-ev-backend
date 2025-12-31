import mongoose from "mongoose";

const categorySchema = mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  inNavbar: {
    type: Boolean,
    default: false
  }
});

// Transform the JSON output to replace _id with id and remove __v
categorySchema.set('toJSON', {
  virtuals: true,
  versionKey: false,
  transform: function (doc, ret) {
    ret.id = ret._id;
    delete ret._id;
  }
});

const Category = mongoose.model("Category", categorySchema);

export default Category;