const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const websiteRoutes = require('./routes/websites');

const app = express();

app.use(cors());
app.use(express.json());

// Database connection check middleware
app.use((req, res, next) => {
    if (req.path.startsWith('/api') && mongoose.connection.readyState !== 1) {
        return res.status(503).json({ error: 'Database is offline. Please make sure MongoDB is running.' });
    }
    next();
});

app.use('/api/websites', websiteRoutes);

app.get('/', (req, res) => {
    const dbStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
    res.json({ status: 'WebVault API running', database: dbStatus });
});

module.exports = app;

