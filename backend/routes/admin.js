const express = require('express');
const router = express.Router();
const Vault = require('../models/Vault');
const Website = require('../models/Website');
const Message = require('../models/Message');
const Presence = require('../models/Presence');

const ADMIN_TOKEN = 'vault-admin-super-secret-2026';

// POST /api/admin/login -> authenticate super admin
router.post('/login', (req, res) => {
    const { username, password } = req.body;
    if (username === 'vault@madhav' && password === 'vault@madhav202610') {
        return res.json({ success: true, token: ADMIN_TOKEN });
    }
    return res.status(401).json({ error: 'Invalid Super Admin credentials.' });
});

// Middleware to authenticate Super Admin
router.use((req, res, next) => {
    const token = req.headers['x-admin-token'];
    if (token !== ADMIN_TOKEN) {
        return res.status(401).json({ error: 'Unauthorized: Invalid Admin Token.' });
    }
    next();
});

// GET /api/admin/vaults -> list all vaults with stats
router.get('/vaults', async (req, res) => {
    try {
        const vaults = await Vault.find().sort({ createdAt: -1 });
        const list = [];
        for (let vault of vaults) {
            const websiteCount = await Website.countDocuments({ vaultId: vault.vaultId });
            list.push({
                vaultId: vault.vaultId,
                createdAt: vault.createdAt,
                suspended: vault.suspended || false,
                renamedTo: vault.renamedTo || null,
                websiteCount
            });
        }
        res.json(list);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// PATCH /api/admin/vaults/:vaultId/suspend -> toggle suspension
router.patch('/vaults/:vaultId/suspend', async (req, res) => {
    try {
        const { vaultId } = req.params;
        const vault = await Vault.findOne({ vaultId });
        if (!vault) {
            return res.status(404).json({ error: 'Vault not found' });
        }
        vault.suspended = !vault.suspended;
        await vault.save();
        res.json({ success: true, suspended: vault.suspended });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// DELETE /api/admin/vaults/:vaultId -> purge vault
router.delete('/vaults/:vaultId', async (req, res) => {
    try {
        const { vaultId } = req.params;
        // Delete vault, websites, messages, presence records
        await Vault.deleteOne({ vaultId });
        await Website.deleteMany({ vaultId });
        await Message.deleteMany({ vaultId });
        await Presence.deleteMany({ vaultId });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
