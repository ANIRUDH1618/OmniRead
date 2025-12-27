import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Please tell us your name'],
        trim: true,
        maxLength: 50
    },
    email: {
        type: String,
        required: [true, 'Please provide your email'],
        unique: true,
        lowercase: true,
        trim: true,
        match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email address'] 
    },
    password: {
        type: String,
        required: [true, 'Please provide a password'],
        minlength: 8,
        select: false 
    },
    role: {
        type: String,
        enum: ['user', 'admin'],
        default: 'user'
    },
    photo: {
        type: String,
        default: 'default' 
    },
    preferences: {
        theme: { 
            type: String, 
            enum: ['light', 'dark'], 
            default: 'light' 
        }
    },
    // [UPDATED] Added 'history' to store daily reading seconds
    streak: {
        currentStreak: { type: Number, default: 0 },
        lastLoginDate: { type: Date, default: Date.now },
        dailyGoalMinutes: { type: Number, default: 30 },
        history: {
            type: Map,
            of: Number,
            default: {}
        }
    },
    otp: {
        type: String,
        select: false 
    },
    otpExpires: {
        type: Date,
        select: false
    },
    bookmarks: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Book'
    }],
    lastRead: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Book'
    },
    createdAt: { type: Date, default: Date.now }
}, {
    timestamps: true 
});

userSchema.pre('save', async function() {
    if (!this.isModified('password')) return;
    this.password = await bcrypt.hash(this.password, 12);
});

userSchema.methods.correctPassword = async function(candidatePassword, userPassword) {
    return await bcrypt.compare(candidatePassword, userPassword);
};

export default mongoose.model('User', userSchema);