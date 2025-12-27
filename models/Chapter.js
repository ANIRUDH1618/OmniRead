import mongoose from 'mongoose';

const chapterSchema = new mongoose.Schema({
    book: { type: mongoose.Schema.Types.ObjectId, ref: 'Book', required: true },
    title: { type: String, required: true },
    order: { type: Number, required: true },
    
    // CONTENT FIELD:
    // - If 'manual_text': Holds HTML string
    // - If 'pdf_collection': Holds Cloudinary URL
    // - If 'pdf_single': Can be empty (or holds specific notes)
    content: { type: String, default: "" }, 

    // [NEW] POINTERS: Used specifically for 'pdf_single'
    startPage: { type: Number, default: 1 }, 
    endPage: { type: Number } 

});

chapterSchema.index({ book: 1, order: 1 }, { unique: true });
export default mongoose.model('Chapter', chapterSchema);