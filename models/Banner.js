import mongoose from "mongoose";

const bannerSchema = mongoose.Schema({
  slot: {
    type: String,
    required: true,
    unique: true,
    enum: ['main', 'side1', 'side2', 'side3', 'side4'] 
  },
  image: {
    type: String,
    required: true
  },
  title: {
    type: String,
    default: ''
  },
  linkType: {
    type: String,
    enum: ['none', 'static', 'category', 'section'],
    default: 'none'
  },
  linkValue: {
    type: String, // Stores URL path (static) or ObjectId (category/section)
    default: ''
  }
}, {
  timestamps: true
});

bannerSchema.set('toJSON', {
  virtuals: true,
  versionKey: false,
  transform: function (doc, ret) {
    ret.id = ret._id;
    delete ret._id;
  }
});

const Banner = mongoose.model("Banner", bannerSchema);

export default Banner;