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

// Vault rename redirection middleware
app.use(async (req, res, next) => {
    if (req.path.startsWith('/api')) {
        const vaultId = req.headers['x-vault-id'];
        if (vaultId) {
            try {
                const Vault = require('./models/Vault');
                const vault = await Vault.findOne({ vaultId: vaultId.trim() });
                if (vault && vault.renamedTo) {
                    return res.status(409).json({
                        error: 'Vault renamed',
                        code: 'VAULT_RENAMED',
                        renamedTo: vault.renamedTo
                    });
                }
            } catch (err) {
                console.error('Error checking vault rename status:', err);
            }
        }
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

