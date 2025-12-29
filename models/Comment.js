import mongoose from 'mongoose';

const commentSchema = new mongoose.Schema({
  content: {
    type: String,
    required: [true, 'Comment cannot be empty.'],
    trim: true,
    maxlength: [1000, 'Comment cannot exceed 1000 characters.']
  },
  author: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  post: { type: mongoose.Schema.Types.ObjectId, ref: 'Post' },
  book: { type: mongoose.Schema.Types.ObjectId, ref: 'Book' },
  chapter: { type: mongoose.Schema.Types.ObjectId, ref: 'Chapter' }, // Optional link to chapter
  
  // [NEW] Reply System
  parent: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Comment',
    default: null
  },
  
  createdAt: {
    type: Date,
    default: Date.now
  }
});


const Comment = mongoose.model('Comment', commentSchema);
export default Comment;