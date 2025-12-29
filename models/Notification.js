import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema({
    recipient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    type: { 
        type: String, 
        enum: ['comment_post', 'comment_book', 'like_post', 'reply_comment'], // [ADDED] reply_comment
        required: true 
    },
    resourceId: { type: mongoose.Schema.Types.ObjectId, required: true }, 
    relatedId: { type: mongoose.Schema.Types.ObjectId }, 
    summary: { type: String }, 
    context: { type: String }, 
    isRead: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now }
});

export default mongoose.model('Notification', notificationSchema);