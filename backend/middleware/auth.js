const jwt = require('jsonwebtoken');
const Vault = require('../models/Vault');
const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret_key_change_me_in_production_123';

async function requireVaultSession(req, res, next) {
    // If it's an public route, skip
    if (req.path.startsWith('/api/auth') || req.path === '/' || req.path.startsWith('/api/admin')) {
        return next();
    }

    const vaultId = req.headers['x-vault-id'] || req.query.vaultId || req.vaultId;
    if (!vaultId) {
        return next(); // Let downstream route-specific vault validation handle missing vaultId
    }

    try {
        const vault = await Vault.findOne({ vaultId: vaultId.trim() });
        if (!vault || !vault.faceAuthEnabled) {
            // Face auth not enabled yet, allow access to proceed
            return next();
        }

        // Face auth is enabled. Check for a valid session token
        const authHeader = req.headers['authorization'];
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({
                error: 'Authentication required. Face authentication is enabled for this vault.',
                code: 'FACE_AUTH_REQUIRED'
            });
        }

        const token = authHeader.split(' ')[1];
        try {
            const decoded = jwt.verify(token, JWT_SECRET);
            if (decoded.vaultId !== vault.vaultId || !decoded.isAuthenticated) {
                return res.status(401).json({
                    error: 'Session mismatch or invalid session scope.',
                    code: 'INVALID_SESSION'
                });
            }
            req.sessionVaultId = decoded.vaultId;
            next();
        } catch (jwtErr) {
            return res.status(401).json({
                error: 'Your session has expired or is invalid. Please log in again.',
                code: 'SESSION_EXPIRED'
            });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
}

module.exports = { requireVaultSession };
