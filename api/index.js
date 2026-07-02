require('dotenv').config();
const mongoose = require('mongoose');
const app = require('../backend/app');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/webvault';

let isConnected = false;

const connectDb = async () => {
    if (isConnected) return;
    try {
        // Use connection options suitable for Serverless environments
        await mongoose.connect(MONGO_URI);
        isConnected = true;
        console.log('Connected to MongoDB Atlas');
    } catch (err) {
        console.error('Database connection error in Serverless Function:', err);
        throw err;
    }
};

module.exports = async (req, res) => {
    try {
        await connectDb();
    } catch (err) {
        return res.status(500).json({ error: 'Database connection failed' });
    }
    return app(req, res);
};
