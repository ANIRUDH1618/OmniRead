import mongoose from 'mongoose';

const progressSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: [true, 'Progress must belong to a User']
    },
    book: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Book',
        required: [true, 'Progress must belong to a Book']
    },
    // Global Progress
    currentChapterIndex: { type: Number, default: 0 },
    currentPage: { type: Number, default: 1 },
    percentComplete: { type: Number, default: 0, min: 0, max: 100 },
    
    // [NEW] Granular Chapter Tracking
    // Stores progress for specific chapters: [{ chapterIndex: 0, percent: 50 }, ...]
    chapterProgress: [{
        chapterIndex: { type: Number, required: true },
        percent: { type: Number, default: 0 }
    }],

    isBookmarked: { type: Boolean, default: false },
    lastRead: { type: Date, default: Date.now }
}, {
    timestamps: true, // Adds createdAt/updatedAt automatically
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

progressSchema.index({ user: 1, book: 1 }, { unique: true });

export default mongoose.model('Progress', progressSchema);