const mongoose = require('mongoose');

const presenceSchema = new mongoose.Schema({
    vaultId: { type: String, required: true, index: true },
    username: { type: String, required: true },
    lastActive: { type: Date, default: Date.now, index: true }
});

// Compound index to quickly find/upsert active user per vault
presenceSchema.index({ vaultId: 1, username: 1 }, { unique: true });

module.exports = mongoose.model('Presence', presenceSchema);
