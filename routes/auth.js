import express from "express";
import jwt from "jsonwebtoken";
import { OAuth2Client } from "google-auth-library";
import User from "../models/User.js";
import Progress from "../models/Progress.js"; 
import Book from "../models/Book.js"; 
import crypto from "crypto";
import nodemailer from "nodemailer";
import multer from 'multer';
import { v2 as cloudinary } from 'cloudinary';
import { CloudinaryStorage } from 'multer-storage-cloudinary';

const router = express.Router();
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// 1. CLOUDINARY
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

const avatarStorage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
        folder: 'omniread-avatars',
        allowed_formats: ['jpg', 'png', 'jpeg', 'webp'],
        transformation: [{ width: 400, height: 400, crop: "fill", gravity: "face" }]
    },
});
const upload = multer({ storage: avatarStorage });

// 2. HELPERS
const signToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET || "default-secret-key", { expiresIn: "90d" });
};

const createSendToken = (user, statusCode, res) => {
    const token = signToken(user._id);
    const IN_PROD = process.env.NODE_ENV === 'production';
    const cookieOptions = {
        expires: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), 
        httpOnly: true, 
        secure: IN_PROD, 
        sameSite: 'lax',
        path: '/' 
    };
    res.clearCookie('jwt', { path: '/' }); 
    res.cookie('jwt', token, cookieOptions); 
    user.password = undefined;
    res.status(statusCode).json({ success: true, token, data: { user } });
};

const generateAvatar = (name) => {
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=ea580c&color=fff&size=128&bold=true`;
};

// ==========================================
// ROUTES
// ==========================================

router.post("/signup", async (req, res) => {
  try {
    const avatarUrl = generateAvatar(req.body.name);
    const newUser = await User.create({
      name: req.body.name,
      email: req.body.email.toLowerCase().trim(),
      password: req.body.password,
      role: "user",
      photo: avatarUrl 
    });
    createSendToken(newUser, 201, res);
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ success: false, message: "Missing credentials" });

    const user = await User.findOne({ email }).select("+password");
    if (!user || !(await user.correctPassword(password, user.password))) {
      return res.status(401).json({ success: false, message: "Incorrect email or password" });
    }
    if (!user.photo || user.photo === 'default') {
        user.photo = generateAvatar(user.name);
        await user.save({ validateBeforeSave: false });
    }
    createSendToken(user, 200, res);
  } catch (err) {
    res.status(500).json({ success: false, message: "Login Error" });
  }
});

router.get("/logout", (req, res) => {
  res.cookie("jwt", "loggedout", { expires: new Date(Date.now() + 10 * 1000), httpOnly: true, path: '/' });
  res.status(200).json({ status: "success" });
});

router.get("/me", async (req, res) => {
  try {
    if (!req.cookies.jwt) return res.status(401).json({ success: false, message: "Not logged in" });
      
    const decoded = jwt.verify(req.cookies.jwt, process.env.JWT_SECRET || "default-secret-key");
    const user = await User.findById(decoded.id).populate('lastRead');
    
    if (!user) return res.status(404).json({ success: false });

    let progressData = null;
    if (user.lastRead) {
        progressData = await Progress.findOne({ user: user._id, book: user.lastRead._id });
    }

    if (user.photo === 'default') user.photo = generateAvatar(user.name);

    res.status(200).json({ success: true, data: user, progress: progressData });
  } catch (e) {
    res.status(401).json({ success: false });
  }
});

router.put("/me/update", upload.single('avatar'), async (req, res) => {
    try {
        if (!req.cookies.jwt) return res.status(401).json({ success: false });
        const decoded = jwt.verify(req.cookies.jwt, process.env.JWT_SECRET || "default-secret-key");
        
        const updates = {};
        if (req.body.name) updates.name = req.body.name;
        if (req.file) updates.photo = req.file.path; 

        const user = await User.findByIdAndUpdate(decoded.id, updates, { new: true, runValidators: true });
        res.status(200).json({ success: true, data: { user } });
    } catch (err) {
        res.status(500).json({ success: false, message: "Update failed" });
    }
});

router.put("/me/theme", async (req, res) => {
    try {
        if (!req.cookies.jwt) return res.status(401).json({ success: false });
        const decoded = jwt.verify(req.cookies.jwt, process.env.JWT_SECRET || "default-secret-key");
        
        const { theme } = req.body;
        if (!['light', 'dark'].includes(theme)) return res.status(400).json({ success: false });

        const user = await User.findById(decoded.id);
        if (!user.preferences) user.preferences = {};
        user.preferences.theme = theme;
        
        await user.save({ validateBeforeSave: false });
        res.status(200).json({ success: true, theme: user.preferences.theme });
    } catch (err) {
        res.status(500).json({ success: false });
    }
});

router.put("/me/streak", async (req, res) => {
    try {
        if (!req.cookies.jwt) return res.status(401).json({ success: false });
        const decoded = jwt.verify(req.cookies.jwt, process.env.JWT_SECRET || "default-secret-key");
        
        const { secondsAdd, goalMinutes } = req.body;
        const user = await User.findById(decoded.id);
        
        if (goalMinutes) user.streak.dailyGoalMinutes = goalMinutes;
        if (secondsAdd) {
            const today = new Date().toDateString();
            const currentSeconds = user.streak.history.get(today) || 0;
            user.streak.history.set(today, currentSeconds + secondsAdd);
        }

        await user.save();
        res.status(200).json({ success: true, streak: user.streak });
    } catch (err) {
        res.status(500).json({ success: false });
    }
});

router.put("/me/last-read", async (req, res) => {
    try {
        if (!req.cookies.jwt) return res.status(401).json({ success: false });
        const decoded = jwt.verify(req.cookies.jwt, process.env.JWT_SECRET || "default-secret-key");
        
        const { bookId, currentPage, currentChapterIndex, percentComplete, chapterPercent } = req.body;
        if(!bookId) return res.status(400).json({success: false});

        await User.findByIdAndUpdate(decoded.id, { lastRead: bookId });

        let progress = await Progress.findOne({ user: decoded.id, book: bookId });
        if (!progress) progress = new Progress({ user: decoded.id, book: bookId });

        if (currentPage !== undefined) progress.currentPage = currentPage;
        if (currentChapterIndex !== undefined) progress.currentChapterIndex = currentChapterIndex;
        if (percentComplete !== undefined) progress.percentComplete = percentComplete;
        progress.lastRead = Date.now();

        if (chapterPercent !== undefined && currentChapterIndex !== undefined) {
            const chapEntry = progress.chapterProgress.find(c => c.chapterIndex === currentChapterIndex);
            if (chapEntry) chapEntry.percent = chapterPercent;
            else progress.chapterProgress.push({ chapterIndex: currentChapterIndex, percent: chapterPercent });
        }

        await progress.save();
        res.status(200).json({ success: true, progress });
    } catch (e) {
        res.status(500).json({ success: false });
    }
});

router.post("/google-auth", async (req, res) => {
  try {
    const { token } = req.body; 
    const ticket = await client.verifyIdToken({ idToken: token, audience: process.env.GOOGLE_CLIENT_ID });
    const { name, email, picture } = ticket.getPayload();
    let user = await User.findOne({ email });

    if (!user) {
      user = await User.create({ name, email, photo: picture, password: crypto.randomBytes(32).toString("hex"), role: "user" });
    } else {
      const isCustomPhoto = user.photo && user.photo.includes("cloudinary");
      if (!isCustomPhoto && (user.photo === 'default' || user.photo !== picture)) {
          user.photo = picture;
          await user.save({ validateBeforeSave: false });
      }
    }
    createSendToken(user, 200, res);
  } catch (err) { res.status(400).json({ success: false, message: "Google Authentication Failed" }); }
});

// [CRITICAL FIX] FORCED SSL CONFIGURATION
// This prevents Render from trying to use insecure ports (587) that get blocked.
const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 465,
  secure: true, // true for 465, false for other ports
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

router.post("/forgot-password", async (req, res) => {
  try {
    const { email } = req.body;
    
    // [DEBUG LOG 1] Input Tracking
    console.log("------------------------------------------------");
    console.log("🔍 FORGOT PASSWORD DEBUG:");
    console.log("1. Received Email:", email);

    // Sanitize
    const cleanEmail = email.toLowerCase().trim();
    console.log("2. Sanitized Email:", cleanEmail);

    // Search
    const user = await User.findOne({ email: { $regex: new RegExp(`^${cleanEmail}$`, "i") } });

    // [DEBUG LOG 2] DB Result Tracking
    if (user) {
        console.log("3. DB Result: ✅ USER FOUND:", user._id);
        console.log("4. User Email in DB:", user.email);
    } else {
        console.log("3. DB Result: ❌ USER IS NULL (Not found in DB)");
    }
    console.log("------------------------------------------------");

    if (!user) return res.status(404).json({ success: false, message: "No user found." });

    const otp = crypto.randomInt(100000, 999999).toString();
    user.otp = otp;
    user.otpExpires = Date.now() + 10 * 60 * 1000;
    await user.save({ validateBeforeSave: false });

    await transporter.sendMail({
      from: `"OmniRead Security" <${process.env.EMAIL_USER}>`,
      to: user.email,
      subject: "OmniRead Password Reset Cipher",
      text: `Your Verification Code is: ${otp}\n\nThis code expires in 10 minutes.`,
    });
    
    console.log("5. OTP Sent Successfully via SMTP");
    res.status(200).json({ success: true, message: "OTP sent successfully" });

  } catch (error) { 
    // This logs CRASHES (like SMTP connection failures)
    console.error("6. 💥 CRITICAL ERROR:", error); 
    res.status(500).json({ success: false, message: "Server Error: " + error.message }); 
  }
});

router.post("/reset-password", async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;
    const user = await User.findOne({ email: email.toLowerCase().trim(), otp: otp, otpExpires: { $gt: Date.now() } });
    if (!user) return res.status(400).json({ success: false, message: "Invalid or Expired OTP" });

    user.password = newPassword;
    user.otp = undefined;
    user.otpExpires = undefined;
    await user.save(); 
    
    // Auto-login the user into the NEW account
    createSendToken(user, 200, res);

  } catch (error) { res.status(500).json({ success: false, message: "Internal Reset Error" }); }
});

export default router;