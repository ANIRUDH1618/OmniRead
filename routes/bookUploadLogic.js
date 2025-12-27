import express from "express";
import multer from "multer";
import { v2 as cloudinary } from "cloudinary";
import { CloudinaryStorage } from "multer-storage-cloudinary";
import https from "https";
import User from "../models/User.js";
import Book from "../models/Book.js";
import Chapter from "../models/Chapter.js";
import Progress from "../models/Progress.js";
import jwt from "jsonwebtoken";

const router = express.Router();

// --- 1. CLOUDINARY CONFIGURATION ---
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

// Smart Storage: Correctly handles PDFs (raw/image) and Covers (image)
const storage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: async (req, file) => {
        // Generate a unique public ID
        const publicId = `${file.fieldname}_${Date.now()}`;
        
        // Check if file is PDF
        const isPdf = file.mimetype === 'application/pdf';

        return {
            folder: "omniread-books",
            
            // [THE FIX] 
            // If it is a PDF, we force 'raw'. This matches your working URL: '.../raw/upload/...'
            // If it is an Image (cover), we use 'auto' (which resolves to 'image').
            resource_type: isPdf ? 'raw' : 'auto', 
            
            public_id: publicId,
            
            // [IMPORTANT] Do NOT force format: 'pdf'. 
            // Forcing format pushes it to the '/image/' route which causes the 401 error.
            // We leave this undefined for Raw files.
            
            use_filename: true,
            unique_filename: false
        };
    },
});
const upload = multer({ storage });

// --- 2. AUTH MIDDLEWARE ---
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

// ==================================================================
//  THE STREAMER API
// ==================================================================

const fetchSecureFile = (fileUrl, res) => {
    // Ensure HTTPS
    if (fileUrl.startsWith('http://')) fileUrl = fileUrl.replace('http://', 'https://');

    // [SECURITY CHECK] Only allow Cloudinary URLs
    if (!fileUrl.includes("cloudinary.com")) {
        console.error(`Security Block: Attempted to fetch non-Cloudinary URL: ${fileUrl}`);
        return res.status(403).send("Forbidden: Invalid document source.");
    }

    // [User-Agent Fix] 
    const options = {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
    };

    https.get(fileUrl, options, (stream) => {
        // 1. Follow Redirects
        if (stream.statusCode >= 300 && stream.statusCode < 400 && stream.headers.location) {
            return fetchSecureFile(stream.headers.location, res);
        }

        // 2. Handle Errors
        if (stream.statusCode !== 200) {
            console.error(`Stream Error ${stream.statusCode} for: ${fileUrl}`);
            if (!res.headersSent) res.status(stream.statusCode).send("Unable to retrieve document.");
            return;
        }

        // 3. Success - Pipe the stream
        if (!res.headersSent) {
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Access-Control-Allow-Origin', '*'); 
            if (stream.headers['content-length']) {
                res.setHeader('Content-Length', stream.headers['content-length']);
            }
        }
        
        stream.pipe(res);

    }).on('error', (err) => {
        console.error("Streamer Error:", err);
        if (!res.headersSent) res.status(500).send("Stream connection failed.");
    });
};

router.get("/read/:id", protect, async (req, res) => {
    try {
        const { id } = req.params;
        const { chapterIndex } = req.query;

        const book = await Book.findById(id).populate('chapters');
        if (!book) return res.status(404).send("Book not found");

        let targetUrl = book.masterPdfUrl;
        
        if (chapterIndex !== undefined && chapterIndex !== 'null') {
            const idx = parseInt(chapterIndex);
            if (book.chapters && book.chapters[idx]) {
                targetUrl = book.chapters[idx].content;
            }
        }

        if (!targetUrl || !targetUrl.startsWith('http')) {
            console.error("Invalid URL:", targetUrl);
            return res.status(404).send("Document source is missing.");
        }

        fetchSecureFile(targetUrl, res);

    } catch (err) {
        console.error("Reader API Error:", err);
        if (!res.headersSent) res.status(500).send("Server Error");
    }
});

// ==================================================================
//  STANDARD DATA ROUTES
// ==================================================================

router.get("/discover", protect, async (req, res) => {
    try {
        const books = await Book.find().sort({ createdAt: -1 }).populate('uploadedBy', 'name');
        res.json({ success: true, data: books });
    } catch (err) { res.status(500).json({ success: false }); }
});

router.get("/shelf", protect, async (req, res) => {
    try {
        const userId = req.user._id;
        const uploads = await Book.find({ uploadedBy: userId }).sort({ createdAt: -1 });
        const user = await User.findById(userId).populate("bookmarks");
        const bookmarks = user ? user.bookmarks : [];
        const progressDocs = await Progress.find({ user: userId }).populate("book").sort({ lastRead: -1 });
        
        const reading = progressDocs
            .filter(p => p.book)
            .map(p => ({ ...p.book.toObject(), percent: p.percentComplete || 0, progressId: p._id }));

        res.json({ success: true, data: { uploads, bookmarks, reading } });
    } catch (err) { res.status(500).json({ success: false }); }
});

router.get("/:id", protect, async (req, res) => {
    try {
        const book = await Book.findById(req.params.id).populate('chapters');
        if (!book) return res.status(404).json({ success: false });
        const progress = await Progress.findOne({ user: req.user._id, book: book._id });
        res.json({ success: true, book, chapters: book.chapters || [], userProgress: progress || null });
    } catch (err) { res.status(500).json({ success: false }); }
});

// --- UPLOAD ROUTES ---
router.post("/inscribe", protect, upload.fields([{ name: "cover", maxCount: 1 }, { name: "bookFile" }]), async (req, res) => {
    try {
        const { title, author, genres, description, type, content } = req.body;
        
        let schemaType = 'manual_text'; 
        if (type === 'textbook') schemaType = 'pdf_single';
        if (type === 'anthology') schemaType = 'pdf_collection';
        if (type === 'manual') schemaType = 'manual_text';

        let coverUrl = "https://via.placeholder.com/300x450?text=No+Cover";
        if (req.files && req.files.cover) {
            coverUrl = req.files.cover[0].path;
        }

        const newBook = new Book({
            title, author, 
            genres: genres ? genres.split(',').map(g => g.trim()) : [], 
            description, coverImage: coverUrl, uploadedBy: req.user._id, uploadType: schemaType
        });

        if (type === "textbook") {
            if (req.files && req.files.bookFile) {
                newBook.masterPdfUrl = req.files.bookFile[0].path;
            } else {
                throw new Error("No PDF file provided for textbook.");
            }
            newBook.totalChapters = 1;
        } 
        else if (type === "manual") {
            await Chapter.create({ book: newBook._id, title: "Manuscript", order: 1, content: content || "" });
            newBook.totalChapters = 1;
        } 
        else if (type === "anthology") {
            if (req.files && req.files.bookFile) {
                const chapterPromises = req.files.bookFile.map((file, index) => {
                    return Chapter.create({ 
                        book: newBook._id, 
                        title: file.originalname.replace('.pdf', ''), 
                        order: index + 1, 
                        content: file.path 
                    });
                });
                await Promise.all(chapterPromises);
                newBook.totalChapters = req.files.bookFile.length;
            }
        }

        await newBook.save();
        res.status(201).json({ success: true, data: newBook });

    } catch (err) { 
        console.error("Upload Error:", err);
        res.status(500).json({ success: false, message: err.message || "Upload Failed" }); 
    }
});

// [FIXED] BOOKMARK ROUTE
// Now returns the updated 'bookmarks' array so the frontend doesn't crash.
router.put("/:id/bookmark", protect, async (req, res) => {
    try {
        const user = await User.findById(req.user._id);
        const index = user.bookmarks.indexOf(req.params.id);
        if (index === -1) user.bookmarks.push(req.params.id); else user.bookmarks.pull(req.params.id);
        await user.save({ validateBeforeSave: false });
        
        // [FIX] Return the updated array!
        res.json({ success: true, bookmarks: user.bookmarks });
        
    } catch (err) { res.status(500).json({ success: false }); }
});

router.post("/:id/chapters", protect, upload.single('chapterFile'), async (req, res) => {
    try {
        const book = await Book.findById(req.params.id);
        const count = await Chapter.countDocuments({ book: book._id });
        const fileUrl = req.file ? req.file.path : "";
        await Chapter.create({ book: book._id, title: req.body.title || `Chapter ${count + 1}`, order: count + 1, content: fileUrl });
        book.totalChapters = count + 1;
        await book.save();
        res.json({ success: true });
    } catch (err) { res.status(500).json({ success: false }); }
});

router.delete("/:bookId/chapters/:chapterId", protect, async (req, res) => {
    try {
        await Chapter.findByIdAndDelete(req.params.chapterId);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ success: false }); }
});

export default router;