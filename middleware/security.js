import express from 'express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';

// [CUSTOM SANITIZER]
const sanitizeData = (obj) => {
    if (obj instanceof Object) {
        for (const key in obj) {
            if (/^\$/.test(key) || key.includes('.')) {
                delete obj[key];
            } else {
                sanitizeData(obj[key]);
            }
        }
    }
};

const sanitizeMiddleware = (req, res, next) => {
    if (req.body) sanitizeData(req.body);
    if (req.query) sanitizeData(req.query);
    if (req.params) sanitizeData(req.params);
    next();
};

const setupSecurity = (app) => {
    // 1. Set Security HTTP Headers
    app.use(helmet({
        // [FIX] Disable policies that break CDNs and Google Login Popups
        contentSecurityPolicy: false,      // Allows Tailwind/Fonts
        crossOriginEmbedderPolicy: false,  // Allows external images/scripts
        crossOriginResourcePolicy: false,  // Allows cross-origin fetching
        crossOriginOpenerPolicy: false     // <--- [CRITICAL FIX] Allows Google Popup to talk to main window
    }));

    // 2. Body Parser
    app.use(express.json({ limit: '10kb' }));

    // 3. Custom Data Sanitization
    app.use(sanitizeMiddleware);

    // 4. Cookie Parser
    app.use(cookieParser());
};

export default setupSecurity;