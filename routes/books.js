import express from "express";
import multer from "multer";
import { v2 as cloudinary } from "cloudinary";
import { CloudinaryStorage } from "multer-storage-cloudinary";
import Book from "../models/Book.js";
import Chapter from "../models/Chapter.js"; // [NEW] Using your Chapter model
import User from "../models/User.js";
import Progress from "../models/Progress.js";
import jwt from "jsonwebtoken";

const router = express.Router();

// --- CLOUDINARY CONFIG ---
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

const storage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
        folder: "omniread-books",
        allowed_formats: ["jpg", "png", "jpeg", "pdf"],
        resource_type: "auto"
    },
});
const upload = multer({ storage });

// --- MIDDLEWARE ---
const protect = async (req, res, next) => {
    try {
        const token = req.cookies.jwt;
        if (!token) return res.status(401).json({ success: false, message: "Unauthorized" });
        
        const decoded = jwt.verify(token, process.env.JWT_SECRET || "default-secret-key");
        req.user = await User.findById(decoded.id);
        
        if(!req.user) return res.status(401).json({ success: false });
        next();
    } catch (err) {
        res.status(401).json({ success: false, message: "Invalid Token" });
    }
};

// =========================================================
// 1. DISCOVER (For Library)
// =========================================================
router.get("/discover", protect, async (req, res) => {
    try {
        // Fetch all books, newest first. 
        // We populate 'uploadedBy' just in case we want to show who added it.
        const books = await Book.find()
            .sort({ createdAt: -1 })
            .populate('uploadedBy', 'name');
            
        res.json({ success: true, data: books });
    } catch (err) {
        console.error("Discover Error:", err);
        res.status(500).json({ success: false, message: "Server Error" });
    }
});

// =========================================================
// 2. SHELF (For Dashboard & Bookshelf)
// =========================================================
router.get("/shelf", protect, async (req, res) => {
    try {
        const userId = req.user._id;

        // A. Uploads: Books created by this user
        const uploads = await Book.find({ uploadedBy: userId }).sort({ createdAt: -1 });

        // B. Bookmarks: Fetch User -> populate 'bookmarks' array
        const userWithBookmarks = await User.findById(userId).populate("bookmarks");
        const bookmarks = userWithBookmarks ? userWithBookmarks.bookmarks : [];

        // C. Reading: Find Progress docs -> populate 'book'
        const progressDocs = await Progress.find({ user: userId })
            .populate("book")
            .sort({ lastRead: -1 });

        // Format reading list (filter out deleted books)
        const reading = progressDocs
            .filter(p => p.book) // Ensure book still exists
            .map(p => ({
                ...p.book.toObject(),
                percent: p.percentComplete || 0,
                progressId: p._id
            }));

        res.json({
            success: true,
            data: { uploads, bookmarks, reading }
        });
    } catch (err) {
        console.error("Shelf Error:", err);
        res.status(500).json({ success: false, message: "Shelf Load Failed" });
    }
});

// =========================================================
// 3. BOOK DETAILS (For Reader & Inscribe Edit)
// =========================================================
router.get("/:id", protect, async (req, res) => {
    try {
        // Fetch Book and populate the virtual 'chapters' field
        const book = await Book.findById(req.params.id).populate('chapters');
        
        if (!book) return res.status(404).json({ success: false, message: "Book not found" });

        // Get User's Progress
        const progress = await Progress.findOne({ user: req.user._id, book: book._id });

        res.json({
            success: true,
            book,
            chapters: book.chapters || [], // Uses the virtual field from your Book.js
            userProgress: progress || null
        });
    } catch (err) {
        console.error("Book Detail Error:", err);
        res.status(500).json({ success: false });
    }
});

// =========================================================
// 4. INSCRIBE (Upload Logic using your Schemas)
// =========================================================
const uploadFields = upload.fields([
    { name: "cover", maxCount: 1 },
    { name: "bookFile" } // Can be multiple for anthology
]);

router.post("/inscribe", protect, uploadFields, async (req, res) => {
    try {
        const { title, author, genres, description, type, content } = req.body;
        
        // 1. Cover Image
        let coverUrl = "https://via.placeholder.com/300x450?text=No+Cover";
        if (req.files && req.files.cover) {
            coverUrl = req.files.cover[0].path;
        }

        // 2. Create the BOOK Document first
        const newBook = new Book({
            title, 
            author, 
            genres: genres ? genres.split(',').map(g => g.trim()) : [], 
            description,
            coverImage: coverUrl,
            uploadedBy: req.user._id,
            uploadType: type
        });

        // 3. Handle Content based on Type
        if (type === "textbook") {
            // Single PDF -> Save to masterPdfUrl in Book
            if (req.files && req.files.bookFile) {
                newBook.masterPdfUrl = req.files.bookFile[0].path;
            }
            newBook.totalChapters = 1;
        } 
        else if (type === "manual") {
            // Manual Text -> Create 1 Chapter
            const chapter = await Chapter.create({
                book: newBook._id,
                title: "Manuscript",
                order: 1,
                content: content || ""
            });
            newBook.totalChapters = 1;
        }
        else if (type === "anthology") {
            // Multiple PDFs -> Create multiple Chapter documents
            if (req.files && req.files.bookFile) {
                const chapterPromises = req.files.bookFile.map((file, index) => {
                    return Chapter.create({
                        book: newBook._id,
                        title: file.originalname.replace('.pdf', ''),
                        order: index + 1,
                        content: file.path // Cloudinary URL
                    });
                });
                await Promise.all(chapterPromises);
                newBook.totalChapters = req.files.bookFile.length;
            }
        }

        await newBook.save();
        res.status(201).json({ success: true, data: newBook });

    } catch (err) {
        console.error("Inscribe Error:", err);
        res.status(500).json({ success: false, message: "Inscription Failed" });
    }
});

// =========================================================
// 5. ADD CHAPTER (For Editing)
// =========================================================
router.post("/:id/chapters", protect, upload.single('chapterFile'), async (req, res) => {
    try {
        const book = await Book.findById(req.params.id);
        if (!book) return res.status(404).json({ success: false });
        
        // Security: Only owner can edit
        if (book.uploadedBy.toString() !== req.user._id.toString()) {
            return res.status(403).json({ success: false, message: "Not your book" });
        }

        const { title } = req.body;
        const fileUrl = req.file ? req.file.path : "";

        // Determine Order
        const count = await Chapter.countDocuments({ book: book._id });

        await Chapter.create({
            book: book._id,
            title: title || `Chapter ${count + 1}`,
            order: count + 1,
            content: fileUrl
        });

        // Update book total
        book.totalChapters = count + 1;
        await book.save();

        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// =========================================================
// 6. DELETE CHAPTER
// =========================================================
router.delete("/:bookId/chapters/:chapterId", protect, async (req, res) => {
    try {
        const chapter = await Chapter.findById(req.params.chapterId);
        if (!chapter) return res.status(404).json({ success: false });

        // Verify ownership via Book
        const book = await Book.findById(req.params.bookId);
        if (!book || book.uploadedBy.toString() !== req.user._id.toString()) {
            return res.status(403).json({ success: false });
        }

        await Chapter.findByIdAndDelete(req.params.chapterId);
        
        // Decrease count
        book.totalChapters = Math.max(0, book.totalChapters - 1);
        await book.save();

        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false });
    }
});

// =========================================================
// 7. BOOKMARK TOGGLE
// =========================================================
router.put("/:id/bookmark", protect, async (req, res) => {
    try {
        const bookId = req.params.id;
        const user = await User.findById(req.user._id);

        // Toggle logic
        const index = user.bookmarks.indexOf(bookId);
        if (index === -1) {
            user.bookmarks.push(bookId);
        } else {
            user.bookmarks.pull(bookId);
        }

        await user.save({ validateBeforeSave: false });
        res.json({ success: true, bookmarks: user.bookmarks });
    } catch (err) {
        res.status(500).json({ success: false });
    }
});

export default router;