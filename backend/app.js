const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const websiteRoutes = require('./routes/websites');
const messageRoutes = require('./routes/messages');

// Toggle to stop the website and show an error (set to false to run normal operations)
const IS_WEBSITE_STOPPED = false;

const app = express();

app.use(cors());
app.use(express.json());

// Website status check middleware
app.use((req, res, next) => {
    if (IS_WEBSITE_STOPPED) {
        return res.status(503).json({
            error: 'Website is currently stopped.',
            code: 'WEBSITE_STOPPED',
            message: 'This service has been temporarily stopped by the owner. Please try again later.'
        });
    }
    next();
});

// Database connection check middleware
app.use((req, res, next) => {
    if (req.path.startsWith('/api') && mongoose.connection.readyState !== 1) {
        return res.status(503).json({ error: 'Database is offline. Please make sure MongoDB is running.' });
    }
    next();
});

app.use('/api/websites', websiteRoutes);
app.use('/api/messages', messageRoutes);



app.get('/', (req, res) => {
    const dbStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
    res.json({ status: 'WebVault API running', database: dbStatus });
});

module.exports = app;

