const mongoose = require('mongoose');

const vaultSchema = new mongoose.Schema({
    vaultId: { type: String, required: true, unique: true, trim: true, index: true },
    creatorToken: { type: String, required: true, trim: true },
    creatorPin: { type: String, default: '000000', trim: true },
    renamedTo: { type: String, default: null, trim: true },
    suspended: { type: Boolean, default: false },
    faceAuthEnabled: { type: Boolean, default: false },
    encryptedFaceEmbedding: { type: String, default: null },
    faceAuthSalt: { type: String, default: null },
    failedLoginAttempts: { type: Number, default: 0 },
    lockoutUntil: { type: Date, default: null },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Vault', vaultSchema);
