require('dotenv').config();
const mongoose = require('mongoose');
const app = require('./app');

const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/webvault';

// Start the Express server immediately to prevent connection refused errors
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    
    console.log('Connecting to MongoDB...');
    mongoose
        .connect(MONGO_URI)
        .then(async () => {
            console.log('Connected to MongoDB');
            try {
                const Website = require('./models/Website');
                const result = await Website.updateMany(
                    { vaultId: { $exists: false } },
                    { $set: { vaultId: 'guest@webvault.local' } }
                );
                if (result.modifiedCount > 0) {
                    console.log(`Migrated ${result.modifiedCount} legacy website records to default guest vault.`);
                }
            } catch (migrationErr) {
                console.error('Migration error:', migrationErr.message);
            }
        })
        .catch((err) => {
            console.error('MongoDB connection error:', err.message);
            console.log('Server is running but database features will be unavailable until MongoDB is started.');
        });
});

