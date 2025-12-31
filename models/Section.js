import mongoose from "mongoose";

const sectionSchema = mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  isMarquee: {
    type: Boolean,
    default: false
  },
  order: {
    type: Number,
    default: 0
  }
});

// Transform _id to id
sectionSchema.set('toJSON', {
  virtuals: true,
  versionKey: false,
  transform: function (doc, ret) {
    ret.id = ret._id;
    delete ret._id;
  }
});

const Section = mongoose.model("Section", sectionSchema);

export default Section;