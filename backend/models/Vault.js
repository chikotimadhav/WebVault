const mongoose = require('mongoose');

const vaultSchema = new mongoose.Schema({
    vaultId: { type: String, required: true, unique: true, trim: true, index: true },
    creatorToken: { type: String, required: true, trim: true },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Vault', vaultSchema);
