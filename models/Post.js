import mongoose from 'mongoose';

const postSchema = new mongoose.Schema({
  author: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'A post must have an author.']
  },
  content: {
    type: String,
    trim: true,
    maxlength: [2000, 'A post cannot exceed 2000 characters.']
  },
  images: {
    type: [String],
    validate: {
      validator: function(val) { return val.length <= 5; },
      message: 'You can only upload a maximum of 5 images per post.'
    }
  },
  likes: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  createdAt: {
    type: Date,
    default: Date.now
  }
}, {
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for comment counting
postSchema.virtual('comments', {
  ref: 'Comment',
  foreignField: 'post',
  localField: '_id'
});

// [CRITICAL FIX] Removed the pre(/^find/) hook here.
// This prevents the "Double Populate" crash.
// We will handle population explicitly in the route controller.

const Post = mongoose.model('Post', postSchema);
export default Post;