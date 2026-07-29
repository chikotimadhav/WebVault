const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
    vaultId: { type: String, required: true, trim: true, index: true },
    sender: { type: String, required: true, trim: true },
    text: { type: String, required: true, trim: true },
    timestamp: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Message', messageSchema);
