import mongoose from 'mongoose';

const bookSchema = new mongoose.Schema({
    title: { type: String, required: true, trim: true },
    author: { type: String, required: true },
    coverImage: { type: String, required: true },
    description: { type: String, trim: true },
    genres: [String],
    totalChapters: { type: Number, default: 0 },
    
    // [CRITICAL FIX] Link the book to the user
    uploadedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true 
    },

    uploadType: {
        type: String,
        enum: ['manual_text', 'pdf_collection', 'pdf_single'], 
        required: true
    },
    
    masterPdfUrl: { type: String } 

}, { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } });

bookSchema.virtual('chapters', {
    ref: 'Chapter',
    foreignField: 'book',
    localField: '_id',
    options: { sort: { order: 1 } }
});

export default mongoose.model('Book', bookSchema);