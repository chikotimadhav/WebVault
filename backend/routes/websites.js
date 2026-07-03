const express = require('express');
const router = express.Router();
const Website = require('../models/Website');

// Middleware to extract x-vault-id header for all website API operations (with fallback for legacy clients)
router.use((req, res, next) => {
    const vaultId = req.headers['x-vault-id'];
    // If header is missing, fall back to default legacy guest vault to prevent breaking old clients
    req.vaultId = vaultId || 'guest@webvault.local';
    next();
});

// GET /api/websites  -> list all (newest first) for specific vaultId
router.get('/', async (req, res) => {
    try {
        const websites = await Website.find({ vaultId: req.vaultId }).sort({ added: -1 });
        res.json(websites);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch websites' });
    }
});

// POST /api/websites -> create new in specific vaultId
router.post('/', async (req, res) => {
    try {
        let { title, url, category, notes } = req.body;

        if (!url || !url.trim()) {
            return res.status(400).json({ error: 'URL is required' });
        }
        if (!/^https?:\/\//i.test(url)) {
            url = 'https://' + url;
        }
        try {
            new URL(url);
        } catch {
            return res.status(400).json({ error: 'Invalid URL' });
        }

        const website = new Website({
            title: (title && title.trim()) || url,
            url,
            category: category || 'Others',
            notes: notes || '',
            fav: false,
            visits: 0,
            added: Date.now(),
            vaultId: req.vaultId
        });

        const saved = await website.save();
        res.status(201).json(saved);
    } catch (err) {
        res.status(500).json({ error: 'Failed to create website' });
    }
});

// PUT /api/websites/:id -> edit title/category/notes/url in specific vaultId
router.put('/:id', async (req, res) => {
    try {
        const { title, url, category, notes } = req.body;
        const update = {};
        if (title !== undefined) update.title = title.trim();
        if (url !== undefined) update.url = url.trim();
        if (category !== undefined) update.category = category.trim();
        if (notes !== undefined) update.notes = notes.trim();

        const updated = await Website.findOneAndUpdate(
            { _id: req.params.id, vaultId: req.vaultId }, 
            update, 
            { new: true }
        );
        if (!updated) return res.status(404).json({ error: 'Website not found in this vault' });
        res.json(updated);
    } catch (err) {
        res.status(500).json({ error: 'Failed to update website' });
    }
});

// PATCH /api/websites/:id/fav -> toggle favorite in specific vaultId
router.patch('/:id/fav', async (req, res) => {
    try {
        const site = await Website.findOne({ _id: req.params.id, vaultId: req.vaultId });
        if (!site) return res.status(404).json({ error: 'Website not found in this vault' });
        site.fav = !site.fav;
        await site.save();
        res.json(site);
    } catch (err) {
        res.status(500).json({ error: 'Failed to toggle favorite' });
    }
});

// PATCH /api/websites/:id/visit -> increment visit count in specific vaultId
router.patch('/:id/visit', async (req, res) => {
    try {
        const site = await Website.findOneAndUpdate(
            { _id: req.params.id, vaultId: req.vaultId },
            { 
                $inc: { visits: 1 },
                $push: { history: Date.now() }
            },
            { new: true }
        );
        if (!site) return res.status(404).json({ error: 'Website not found in this vault' });
        res.json(site);
    } catch (err) {
        res.status(500).json({ error: 'Failed to record visit' });
    }
});

// DELETE /api/websites/:id -> remove in specific vaultId
router.delete('/:id', async (req, res) => {
    try {
        const deleted = await Website.findOneAndDelete({ _id: req.params.id, vaultId: req.vaultId });
        if (!deleted) return res.status(404).json({ error: 'Website not found in this vault' });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Failed to delete website' });
    }
});

module.exports = router;

