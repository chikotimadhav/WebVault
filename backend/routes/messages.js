const express = require('express');
const router = express.Router();
const Message = require('../models/Message');
const Presence = require('../models/Presence');

// Middleware to extract x-vault-id header for all message API operations
router.use((req, res, next) => {
    const vaultId = req.headers['x-vault-id'];
    req.vaultId = vaultId || 'guest@webvault.local';
    next();
});

// GET /api/messages -> list messages and online users for specific vaultId
router.get('/', async (req, res) => {
    try {
        const username = req.query.username;
        if (username && username.trim()) {
            const name = username.trim();
            // Update/upsert presence for the user
            await Presence.findOneAndUpdate(
                { vaultId: req.vaultId, username: name },
                { lastActive: new Date() },
                { upsert: true, new: true }
            );
        }

        // Fetch messages
        const messages = await Message.find({ vaultId: req.vaultId })
            .sort({ timestamp: 1 })
            .limit(100);

        // Fetch online users (last active in the last 15 seconds)
        const threshold = new Date(Date.now() - 15000);
        const activePresences = await Presence.find({
            vaultId: req.vaultId,
            lastActive: { $gt: threshold }
        });
        const onlineUsers = activePresences.map(p => p.username);

        res.json({ messages, onlineUsers });
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch messages' });
    }
});

// POST /api/messages -> post a new message
router.post('/', async (req, res) => {
    try {
        const { sender, text } = req.body;
        if (!sender || !sender.trim()) {
            return res.status(400).json({ error: 'Sender name is required' });
        }
        if (!text || !text.trim()) {
            return res.status(400).json({ error: 'Message text is required' });
        }

        const message = new Message({
            vaultId: req.vaultId,
            sender: sender.trim(),
            text: text.trim(),
            timestamp: new Date()
        });

        const saved = await message.save();
        res.status(201).json(saved);
    } catch (err) {
        res.status(500).json({ error: 'Failed to send message' });
    }
});

module.exports = router;
