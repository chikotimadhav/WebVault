const express = require('express');
const router = express.Router();
const Website = require('../models/Website');

// GET /api/websites  -> list all (newest first)
router.get('/', async (req, res) => {
    try {
        const websites = await Website.find().sort({ added: -1 });
        res.json(websites);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch websites' });
    }
});

// POST /api/websites -> create new
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
            added: Date.now()
        });

        const saved = await website.save();
        res.status(201).json(saved);
    } catch (err) {
        res.status(500).json({ error: 'Failed to create website' });
    }
});

// PUT /api/websites/:id -> edit title/category/notes/url
router.put('/:id', async (req, res) => {
    try {
        const { title, url, category, notes } = req.body;
        const update = {};
        if (title !== undefined) update.title = title.trim();
        if (url !== undefined) update.url = url.trim();
        if (category !== undefined) update.category = category.trim();
        if (notes !== undefined) update.notes = notes.trim();

        const updated = await Website.findByIdAndUpdate(req.params.id, update, { new: true });
        if (!updated) return res.status(404).json({ error: 'Website not found' });
        res.json(updated);
    } catch (err) {
        res.status(500).json({ error: 'Failed to update website' });
    }
});

// PATCH /api/websites/:id/fav -> toggle favorite
router.patch('/:id/fav', async (req, res) => {
    try {
        const site = await Website.findById(req.params.id);
        if (!site) return res.status(404).json({ error: 'Website not found' });
        site.fav = !site.fav;
        await site.save();
        res.json(site);
    } catch (err) {
        res.status(500).json({ error: 'Failed to toggle favorite' });
    }
});

// PATCH /api/websites/:id/visit -> increment visit count
router.patch('/:id/visit', async (req, res) => {
    try {
        const site = await Website.findByIdAndUpdate(
            req.params.id,
            { 
                $inc: { visits: 1 },
                $push: { history: Date.now() }
            },
            { new: true }
        );
        if (!site) return res.status(404).json({ error: 'Website not found' });
        res.json(site);
    } catch (err) {
        res.status(500).json({ error: 'Failed to record visit' });
    }
});

// DELETE /api/websites/:id -> remove
router.delete('/:id', async (req, res) => {
    try {
        const deleted = await Website.findByIdAndDelete(req.params.id);
        if (!deleted) return res.status(404).json({ error: 'Website not found' });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Failed to delete website' });
    }
});

module.exports = router;
