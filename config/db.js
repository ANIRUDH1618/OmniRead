import mongoose from 'mongoose';
import dotenv from 'dotenv';

// Load env vars if not already loaded (optional if loaded in server.js, but safe to keep)
dotenv.config({ path: './config.env' });

const connectDB = async () => {
  try {
    // Check if variables exist to prevent vague errors
    if (!process.env.DATABASE || !process.env.DATABASE_PASSWORD) {
      throw new Error('Database configuration missing in config.env');
    }

    const DB = process.env.DATABASE.replace(
      '<PASSWORD>',
      process.env.DATABASE_PASSWORD
    );

    await mongoose.connect(DB);
    console.log('✅ MongoDB connection successful!');
  } catch (err) {
    console.error('❌ DB Connection Error:', err.message);
    // Exit process with failure
    process.exit(1);
  }
};

export default connectDB;