const express = require('express');
const router = express.Router();
const Website = require('../models/Website');
const Vault = require('../models/Vault');

// Helper to ensure vault registration
async function ensureVaultRegistered(vaultId, creatorToken) {
    if (!vaultId) return;
    try {
        let vault = await Vault.findOne({ vaultId });
        if (!vault) {
            vault = new Vault({
                vaultId,
                creatorToken: creatorToken || 'legacy-guest-token',
                creatorPin: '000000'
            });
            await vault.save();
        }
    } catch (err) {
        console.error('Error ensuring vault is registered:', err);
    }
}

// GET /api/websites/vault/check -> check if vault exists (before middleware)
router.get('/vault/check', async (req, res) => {
    try {
        const { vaultId } = req.query;
        if (!vaultId) {
            return res.status(400).json({ error: 'Vault ID parameter is required' });
        }
        const vault = await Vault.findOne({ vaultId: vaultId.trim() });
        res.json({ exists: !!vault });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/websites/vault/create -> create new vault with pin (before middleware)
router.post('/vault/create', async (req, res) => {
    try {
        const { vaultId, creatorToken, creatorPin } = req.body;
        if (!vaultId || !creatorPin) {
            return res.status(400).json({ error: 'Vault ID and 6-digit PIN are required.' });
        }
        const cleanedPin = creatorPin.toString().trim();
        if (cleanedPin.length !== 6 || isNaN(cleanedPin)) {
            return res.status(400).json({ error: 'PIN must be exactly 6 digits.' });
        }

        let vault = await Vault.findOne({ vaultId: vaultId.trim() });
        if (vault) {
            return res.status(400).json({ error: 'Vault ID already exists.' });
        }

        vault = new Vault({
            vaultId: vaultId.trim(),
            creatorToken: creatorToken || 'legacy-guest-token',
            creatorPin: cleanedPin
        });
        await vault.save();
        res.status(201).json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Middleware to extract x-vault-id header for all website API operations (with fallback for legacy clients)
router.use(async (req, res, next) => {
    const vaultId = req.headers['x-vault-id'];
    // If header is missing, fall back to default legacy guest vault to prevent breaking old clients
    req.vaultId = vaultId || 'guest@webvault.local';
    req.creatorToken = req.headers['x-creator-token'] || '';

    // Register vault if it does not exist yet
    await ensureVaultRegistered(req.vaultId, req.creatorToken);

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

// PUT /api/websites/vault/rename -> Rename vault ID (restricted to creator)
router.put('/vault/rename', async (req, res) => {
    try {
        const creatorPin = req.headers['x-creator-pin'] || '';
        const { newVaultId } = req.body;
        if (!newVaultId || !newVaultId.trim()) {
            return res.status(400).json({ error: 'New Vault ID is required' });
        }
        const cleanedNewId = newVaultId.trim();

        if (cleanedNewId === req.vaultId) {
            return res.status(400).json({ error: 'New Vault ID must be different from current Vault ID' });
        }

        // Verify that the vault exists and caller is the creator
        const vault = await Vault.findOne({ vaultId: req.vaultId });
        if (!vault) {
            return res.status(404).json({ error: 'Vault not found' });
        }
        if (vault.creatorToken !== req.creatorToken) {
            return res.status(403).json({ error: 'Only the creator of this vault can rename it.' });
        }
        if (vault.creatorPin && vault.creatorPin !== creatorPin) {
            return res.status(403).json({ error: 'Invalid 6-digit Creator PIN.' });
        }

        // Check if the new vault ID already exists
        const destinationExists = await Vault.findOne({ vaultId: cleanedNewId });
        if (destinationExists) {
            return res.status(400).json({ error: 'The destination Vault ID is already in use.' });
        }

        const Message = require('../models/Message');
        const Presence = require('../models/Presence');

        // Rename across all collections
        // 1. Create the new vault record
        const newVault = new Vault({
            vaultId: cleanedNewId,
            creatorToken: vault.creatorToken,
            creatorPin: vault.creatorPin
        });
        await newVault.save();

        // 2. Mark the old vault as renamed
        await Vault.updateOne({ vaultId: req.vaultId }, { $set: { renamedTo: cleanedNewId } });

        // 3. Cascade update websites, messages, and presences
        await Website.updateMany({ vaultId: req.vaultId }, { $set: { vaultId: cleanedNewId } });
        await Message.updateMany({ vaultId: req.vaultId }, { $set: { vaultId: cleanedNewId } });
        await Presence.updateMany({ vaultId: req.vaultId }, { $set: { vaultId: cleanedNewId } });

        res.json({ success: true, newVaultId: cleanedNewId });
    } catch (err) {
        res.status(500).json({ error: 'Failed to rename vault.' });
    }
});

// DELETE /api/websites/purge/all -> delete entire vault and all associated apps, messages, presences (restricted to creator)
router.delete('/purge/all', async (req, res) => {
    try {
        const creatorPin = req.headers['x-creator-pin'] || '';
        const vault = await Vault.findOne({ vaultId: req.vaultId });
        if (!vault) {
            return res.status(404).json({ error: 'Vault not found' });
        }
        if (vault.creatorToken !== req.creatorToken) {
            return res.status(403).json({ error: 'Only the creator of this vault can delete it.' });
        }
        if (vault.creatorPin && vault.creatorPin !== creatorPin) {
            return res.status(403).json({ error: 'Invalid 6-digit Creator PIN.' });
        }

        const Message = require('../models/Message');
        const Presence = require('../models/Presence');

        // Delete everything
        await Vault.deleteOne({ vaultId: req.vaultId });
        const websitesDel = await Website.deleteMany({ vaultId: req.vaultId });
        const messagesDel = await Message.deleteMany({ vaultId: req.vaultId });
        const presencesDel = await Presence.deleteMany({ vaultId: req.vaultId });

        res.json({
            success: true,
            websitesDeleted: websitesDel.deletedCount,
            messagesDeleted: messagesDel.deletedCount,
            presencesDeleted: presencesDel.deletedCount
        });
    } catch (err) {
        res.status(500).json({ error: 'Failed to delete vault and all associated data.' });
    }
});

// DELETE /api/websites/:id -> remove in specific vaultId (restricted to creator)
router.delete('/:id', async (req, res) => {
    try {
        const vault = await Vault.findOne({ vaultId: req.vaultId });
        if (vault && vault.creatorToken !== req.creatorToken) {
            return res.status(403).json({ error: 'Only the creator of this vault can delete websites.' });
        }

        const deleted = await Website.findOneAndDelete({ _id: req.params.id, vaultId: req.vaultId });
        if (!deleted) return res.status(404).json({ error: 'Website not found in this vault' });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Failed to delete website' });
    }
});

module.exports = router;

