import express from 'express';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import Notification from '../models/Notification.js';

const router = express.Router();

const protect = async (req, res, next) => {
    try {
        const token = req.cookies.jwt;
        if (!token) return res.status(401).json({ success: false });
        const decoded = jwt.verify(token, process.env.JWT_SECRET || "default-secret-key");
        req.user = await User.findById(decoded.id);
        if(!req.user) return res.status(401).json({ success: false });
        next();
    } catch (err) { res.status(401).json({ success: false }); }
};

// GET NOTIFICATIONS
router.get('/', protect, async (req, res) => {
    try {
        const notifs = await Notification.find({ recipient: req.user._id })
            .sort({ createdAt: -1 })
            .populate('sender', 'name photo')
            .limit(20);
        
        const unreadCount = await Notification.countDocuments({ recipient: req.user._id, isRead: false });
        
        res.json({ success: true, data: notifs, unread: unreadCount });
    } catch (err) { res.status(500).json({ success: false }); }
});

// MARK ALL READ
router.put('/read-all', protect, async (req, res) => {
    try {
        await Notification.updateMany({ recipient: req.user._id, isRead: false }, { isRead: true });
        res.json({ success: true });
    } catch (err) { res.status(500).json({ success: false }); }
});

// [NEW] MARK SINGLE AS READ
router.put('/:id/read', protect, async (req, res) => {
    try {
        await Notification.findByIdAndUpdate(req.params.id, { isRead: true });
        res.json({ success: true });
    } catch (err) { res.status(500).json({ success: false }); }
});

// DELETE NOTIFICATION
router.delete('/:id', protect, async (req, res) => {
    try {
        await Notification.findOneAndDelete({ _id: req.params.id, recipient: req.user._id });
        res.json({ success: true });
    } catch (err) { res.status(500).json({ success: false }); }
});

export default router;