const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const Vault = require('../models/Vault');

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret_key_change_me_in_production_123';
const FACE_AUTH_SECRET = process.env.FACE_AUTH_SECRET || 'secure_face_aes_encryption_key_987!';
const ALGORITHM = 'aes-256-gcm';

// Helper: Encrypt face embedding using AES-256-GCM
function encryptEmbedding(embeddingArray) {
    const text = JSON.stringify(embeddingArray);
    const iv = crypto.randomBytes(12);
    // Derive key from the secret
    const key = crypto.scryptSync(FACE_AUTH_SECRET, 'salt-for-scrypt', 32);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag().toString('hex');
    return {
        encryptedData: `${authTag}:${encrypted}`,
        salt: iv.toString('hex')
    };
}

// Helper: Decrypt face embedding using AES-256-GCM
function decryptEmbedding(encryptedDataWithTag, salt) {
    const parts = encryptedDataWithTag.split(':');
    if (parts.length !== 2) throw new Error('Invalid encrypted data format');
    const authTag = Buffer.from(parts[0], 'hex');
    const encryptedText = parts[1];
    const iv = Buffer.from(salt, 'hex');
    const key = crypto.scryptSync(FACE_AUTH_SECRET, 'salt-for-scrypt', 32);
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return JSON.parse(decrypted);
}

// Helper: Calculate Euclidean distance between two unit vector embeddings
function calculateDistance(arr1, arr2) {
    if (!arr1 || !arr2 || arr1.length !== arr2.length) return 1.0;
    let sum = 0;
    for (let i = 0; i < arr1.length; i++) {
        const diff = arr1[i] - arr2[i];
        sum += diff * diff;
    }
    return Math.sqrt(sum);
}

// GET /api/auth/status -> Check face auth status of a vault
router.get('/status', async (req, res) => {
    try {
        const { vaultId } = req.query;
        if (!vaultId) {
            return res.status(400).json({ error: 'Vault ID parameter is required.' });
        }
        const vault = await Vault.findOne({ vaultId: vaultId.trim() });
        if (!vault) {
            return res.json({ exists: false, faceAuthEnabled: false });
        }
        res.json({
            exists: true,
            faceAuthEnabled: vault.faceAuthEnabled,
            lockoutActive: !!(vault.lockoutUntil && vault.lockoutUntil > new Date()),
            lockoutUntil: vault.lockoutUntil
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Middleware: Check Account Lockout status
async function checkLockout(req, res, next) {
    const { vaultId } = req.body;
    if (!vaultId) return res.status(400).json({ error: 'Vault ID is required.' });

    try {
        const vault = await Vault.findOne({ vaultId: vaultId.trim() });
        if (vault && vault.lockoutUntil && vault.lockoutUntil > new Date()) {
            const minutesLeft = Math.ceil((vault.lockoutUntil - new Date()) / 1000 / 60);
            return res.status(423).json({
                error: `This account is temporarily locked due to too many failed attempts. Try again in ${minutesLeft} minutes.`,
                code: 'ACCOUNT_LOCKED',
                lockoutUntil: vault.lockoutUntil
            });
        }
        req.vault = vault;
        next();
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
}

// Helper: Handle failed authentication attempts
async function handleFailedAttempt(vault, res, errorMessage) {
    vault.failedLoginAttempts += 1;
    let lockedOut = false;
    if (vault.failedLoginAttempts >= 5) {
        vault.lockoutUntil = new Date(Date.now() + 15 * 60 * 1000); // 15 mins
        vault.failedLoginAttempts = 0;
        lockedOut = true;
    }
    await vault.save();

    if (lockedOut) {
        return res.status(423).json({
            error: 'Account locked due to too many failed attempts. Try again in 15 minutes.',
            code: 'ACCOUNT_LOCKED',
            lockoutUntil: vault.lockoutUntil
        });
    }

    const attemptsRemaining = 5 - vault.failedLoginAttempts;
    return res.status(401).json({
        error: `${errorMessage} (${attemptsRemaining} attempts remaining before temporary lockout)`,
        attemptsRemaining
    });
}

// POST /api/auth/login-password -> Step 1: Verify Credentials
router.post('/login-password', checkLockout, async (req, res) => {
    try {
        const { creatorPin } = req.body;
        let { vault } = req;

        // If vault doesn't exist, return 404. Let client create vault through the existing create route
        if (!vault) {
            return res.status(404).json({ error: 'Vault does not exist.' });
        }

        const pin = creatorPin ? creatorPin.toString().trim() : '';

        // Check PIN
        if (vault.creatorPin !== pin) {
            return await handleFailedAttempt(vault, res, 'Incorrect PIN.');
        }

        // Pin is correct: reset failure counters
        vault.failedLoginAttempts = 0;
        vault.lockoutUntil = null;
        await vault.save();

        if (vault.faceAuthEnabled) {
            // Return state indicating that face auth verification is required
            return res.json({
                success: true,
                faceAuthRequired: true,
                message: 'Password correct. Face authentication required.'
            });
        } else {
            // Face auth not set up yet. Issue temporary setup token
            const setupToken = jwt.sign(
                { vaultId: vault.vaultId, isSetup: true },
                JWT_SECRET,
                { expiresIn: '15m' }
            );
            return res.json({
                success: true,
                faceAuthRequired: false,
                setupRequired: true,
                token: setupToken,
                message: 'Password correct. Please set up Face Authentication.'
            });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/auth/register-face -> Step 2 (First Time): Register Face Embedding
router.post('/register-face', async (req, res) => {
    try {
        const authHeader = req.headers['authorization'];
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'Unauthorized. Missing setup token.' });
        }

        const token = authHeader.split(' ')[1];
        let decoded;
        try {
            decoded = jwt.verify(token, JWT_SECRET);
        } catch (e) {
            return res.status(401).json({ error: 'Invalid or expired setup token.' });
        }

        if (!decoded.isSetup) {
            return res.status(403).json({ error: 'Invalid token scope for face registration.' });
        }

        const { embedding } = req.body;
        if (!embedding || !Array.isArray(embedding) || embedding.length < 100) {
            return res.status(400).json({ error: 'Invalid face embedding descriptor.' });
        }

        const vault = await Vault.findOne({ vaultId: decoded.vaultId });
        if (!vault) {
            return res.status(404).json({ error: 'Vault not found.' });
        }

        // Encrypt the embedding vector
        const encrypted = encryptEmbedding(embedding);
        vault.encryptedFaceEmbedding = encrypted.encryptedData;
        vault.faceAuthSalt = encrypted.salt;
        vault.faceAuthEnabled = true;
        
        // Reset login attempts
        vault.failedLoginAttempts = 0;
        vault.lockoutUntil = null;

        await vault.save();

        // Issue full access session token
        const sessionToken = jwt.sign(
            { vaultId: vault.vaultId, isAuthenticated: true },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.json({
            success: true,
            message: 'Face authentication registered successfully.',
            token: sessionToken
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/auth/verify-face -> Step 2 (Future Logins): Verify Face Embedding
router.post('/verify-face', checkLockout, async (req, res) => {
    try {
        const { embedding } = req.body;
        const { vault } = req;

        if (!vault) {
            return res.status(404).json({ error: 'Vault does not exist.' });
        }

        if (!vault.faceAuthEnabled || !vault.encryptedFaceEmbedding) {
            return res.status(400).json({ error: 'Face authentication is not set up for this vault.' });
        }

        if (!embedding || !Array.isArray(embedding) || embedding.length < 100) {
            return res.status(400).json({ error: 'Invalid face embedding descriptor.' });
        }

        let decryptedEmbedding;
        try {
            decryptedEmbedding = decryptEmbedding(vault.encryptedFaceEmbedding, vault.faceAuthSalt);
        } catch (decErr) {
            console.error('Decryption error:', decErr);
            return res.status(500).json({ error: 'Internal server error decrypting credentials.' });
        }

        // Calculate Euclidean distance
        const distance = calculateDistance(embedding, decryptedEmbedding);
        const matchThreshold = 0.6; // Standard threshold for face-api.js

        if (distance <= matchThreshold) {
            // Match successful: Reset lockout/attempts
            vault.failedLoginAttempts = 0;
            vault.lockoutUntil = null;
            await vault.save();

            // Generate full access session token
            const sessionToken = jwt.sign(
                { vaultId: vault.vaultId, isAuthenticated: true },
                JWT_SECRET,
                { expiresIn: '24h' }
            );

            return res.json({
                success: true,
                message: 'Face authentication successful.',
                token: sessionToken
            });
        } else {
            // Mismatch: increment failed attempts
            return await handleFailedAttempt(vault, res, 'Face verification failed.');
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
