const mongoose = require('mongoose');

const websiteSchema = new mongoose.Schema({
    title: { type: String, required: true, trim: true },
    url: { type: String, required: true, trim: true },
    category: { type: String, default: 'Others', trim: true },
    notes: { type: String, default: '', trim: true },
    fav: { type: Boolean, default: false },
    visits: { type: Number, default: 0 },
    history: { type: [Number], default: [] },
    added: { type: Number, default: () => Date.now() },
    vaultId: { type: String, required: true, trim: true, index: true }
});

module.exports = mongoose.model('Website', websiteSchema);

