import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import cookieParser from "cookie-parser";

// 1. CONFIG
dotenv.config({ path: "./config.env" });

// 2. IMPORTS
import connectDB from "./config/db.js";
import authRoutes from "./routes/auth.js";
import communityRoutes from './routes/community-routes.js';
import bookUploadRoutes from "./routes/bookUploadLogic.js";
import notificationRoutes from "./routes/notification.js";

// 3. INIT & DB
connectDB();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// 4. MIDDLEWARE
// [FIX] Increased Body Limit for Book Uploads (Default is too small)
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

app.use(cookieParser());
app.use(express.static(path.join(__dirname, "public")));

// --- 5. SECURITY MIDDLEWARE ---
const protectView = (req, res, next) => {
  const token = req.cookies.jwt;
  if (!token) return res.redirect("/login");
  next();
};

// --- 6. ROUTES ---
app.use("/api", authRoutes);
app.use("/api/books", bookUploadRoutes);
app.use('/api/community', communityRoutes);
app.use('/api/notifications', notificationRoutes); // [NEW]

// B. PUBLIC PAGES
app.get("/login", (req, res) =>
  res.sendFile(path.join(__dirname, "public", "login.html"))
);
app.get("/signup", (req, res) =>
  res.sendFile(path.join(__dirname, "public", "signup.html"))
);
app.get("/forgot-password", (req, res) =>
  res.sendFile(path.join(__dirname, "public", "forgot-password.html"))
);

// C. PROTECTED PAGES
app.get("/dashboard", protectView, (req, res) =>
  res.sendFile(path.join(__dirname, "public", "dashboard.html"))
);
app.get("/library", protectView, (req, res) =>
  res.sendFile(path.join(__dirname, "public", "library.html"))
);
app.get("/bookshelf", protectView, (req, res) =>
  res.sendFile(path.join(__dirname, "public", "bookshelf.html"))
);
app.get("/community", protectView, (req, res) =>
  res.sendFile(path.join(__dirname, "public", "community.html"))
);
app.get("/reader.html", protectView, (req, res) =>
  res.sendFile(path.join(__dirname, "public", "reader.html"))
);
app.get("/reader", protectView, (req, res) =>
  res.sendFile(path.join(__dirname, "public", "reader.html"))
);
app.get("/profile", protectView, (req, res) =>
  res.sendFile(path.join(__dirname, "public", "profile.html"))
);
app.get("/inscribe", protectView, (req, res) =>
  res.sendFile(path.join(__dirname, "public", "inscribe.html"))
);

app.get("/", (req, res) => res.redirect("/login"));

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
