import express from "express";
import multer from "multer";
import { v2 as cloudinary } from "cloudinary";
import { CloudinaryStorage } from "multer-storage-cloudinary";
import jwt from "jsonwebtoken";
import User from "../models/User.js";
import Post from "../models/Post.js";
import Comment from "../models/Comment.js";
import Notification from "../models/Notification.js"; 

const router = express.Router();

// --- CONFIGURATION ---
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

const storage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: async (req, file) => {
        return {
            folder: "omniread-posts",
            allowed_formats: ['jpg', 'png', 'jpeg', 'webp'],
            transformation: [{ width: 1200, crop: "limit" }],
            public_id: `post_${Date.now()}_${file.originalname}`
        };
    },
});
const upload = multer({ storage });

const protect = async (req, res, next) => {
    try {
        const token = req.cookies.jwt;
        if (!token) return res.status(401).json({ success: false, message: "Unauthorized" });
        const decoded = jwt.verify(token, process.env.JWT_SECRET || "default-secret-key");
        req.user = await User.findById(decoded.id);
        if(!req.user) return res.status(401).json({ success: false });
        next();
    } catch (err) {
        res.status(401).json({ success: false });
    }
};

// --- ROUTES ---

// GET FEED
router.get("/", protect, async (req, res) => {
    try {
        const posts = await Post.find()
            .sort({ createdAt: -1 })
            .populate('author', 'name photo') 
            .populate({ path: 'comments', select: '_id' }); 

        res.status(200).json({ success: true, count: posts.length, data: posts });
    } catch (err) {
        console.error("FEED FETCH ERROR:", err);
        res.status(500).json({ success: false, message: "Server Error loading feed." });
    }
});

// CREATE POST
router.post("/", protect, upload.array('images', 5), async (req, res) => {
    try {
        if (!req.body.content && (!req.files || req.files.length === 0)) {
             return res.status(400).json({ success: false, message: "Empty post." });
        }

        const imageUrls = req.files ? req.files.map(f => f.path) : [];

        const newPost = new Post({
            author: req.user._id,
            content: req.body.content || "",
            images: imageUrls,
            likes: [],
            createdAt: Date.now()
        });

        await newPost.save();
        await newPost.populate('author', 'name photo'); 

        res.status(201).json({ success: true, data: newPost });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// LIKE POST
router.put("/:id/like", protect, async (req, res) => {
    try {
        const post = await Post.findById(req.params.id);
        if(!post) return res.status(404).json({ success: false });

        const userId = req.user._id;
        const index = post.likes.indexOf(userId);

        if(index === -1) post.likes.push(userId);
        else post.likes.splice(index, 1);
        
        await post.save();
        res.status(200).json({ success: true, likes: post.likes });
    } catch (err) {
        res.status(500).json({ success: false });
    }
});

// DELETE POST
router.delete("/:id", protect, async (req, res) => {
    try {
        const post = await Post.findOneAndDelete({ _id: req.params.id, author: req.user._id });
        if (!post) return res.status(403).json({ success: false });
        await Comment.deleteMany({ post: req.params.id });
        res.status(200).json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false });
    }
});

// ADD COMMENT (Updated with specific summary)
router.post("/:postId/comments", protect, async (req, res) => {
    try {
        if(!req.body.content || req.body.content.trim().length === 0) {
             return res.status(400).json({ success: false, message: "Empty comment." });
        }

        const newComment = await Comment.create({
            content: req.body.content,
            author: req.user._id,
            post: req.params.postId
        });
        await newComment.populate('author', 'name photo');

        // [FIX] Smart Notification Logic for Posts
        const post = await Post.findById(req.params.postId);
        if (post && post.author.toString() !== req.user._id.toString()) {
            await Notification.create({
                recipient: post.author,
                sender: req.user._id,
                type: 'comment_post',
                resourceId: post._id,
                summary: 'commented on your post', // [NEW] Explicit summary
                context: req.body.content.substring(0, 50)
            });
        }

        res.status(201).json({ success: true, data: newComment });
    } catch (err) {
        res.status(500).json({ success: false });
    }
});

// GET COMMENTS
router.get("/:postId/comments", protect, async (req, res) => {
    try {
        const comments = await Comment.find({ post: req.params.postId })
                                      .sort({ createdAt: 1 })
                                      .populate('author', 'name photo');
        res.status(200).json({ success: true, data: comments });
    } catch (err) {
        res.status(500).json({ success: false });
    }
});

// EDIT COMMENT
router.put("/comments/:commentId", protect, async (req, res) => {
    try {
        const { content } = req.body;
        if(!content) return res.status(400).json({ success: false });

        const comment = await Comment.findOne({ _id: req.params.commentId, author: req.user._id });
        if(!comment) return res.status(403).json({ success: false });

        comment.content = content;
        await comment.save();
        await comment.populate('author', 'name photo'); 
        res.status(200).json({ success: true, data: comment });
    } catch (err) {
        res.status(500).json({ success: false });
    }
});

// DELETE COMMENT
router.delete("/comments/:commentId", protect, async (req, res) => {
    try {
        const comment = await Comment.findOneAndDelete({ _id: req.params.commentId, author: req.user._id });
        if(!comment) return res.status(403).json({ success: false });
        res.status(200).json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false });
    }
});

export default router;