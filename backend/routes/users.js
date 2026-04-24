const express = require('express');
const crypto = require('crypto');
const User = require('../models/User');
const Invitation = require('../models/Invitation');
const auth = require('../middleware/auth');

const router = express.Router();

// Middleware to check if admin
const adminOnly = (req, res, next) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Access denied. Admins only.' });
    }
    next();
};

// Get all users
router.get('/', auth, adminOnly, async (req, res) => {
    try {
        const users = await User.find().select('-password').sort({ createdAt: -1 });
        res.json({ users });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// Invite user
router.post('/invite', auth, adminOnly, async (req, res) => {
    try {
        const { email, role } = req.body;
        if (!email || !role) return res.status(400).json({ message: 'Email and role are required' });

        // Check if user already exists
        const existingUser = await User.findOne({ email: email.toLowerCase() });
        if (existingUser) return res.status(400).json({ message: 'User already registered with this email' });

        // Upsert invitation
        const token = crypto.randomBytes(32).toString('hex');
        await Invitation.findOneAndUpdate(
            { email: email.toLowerCase() },
            { 
                role, 
                token, 
                invitedBy: req.user._id,
                isUsed: false,
                expiresAt: new Date(+new Date() + 7*24*60*60*1000)
            },
            { upsate: true, new: true, setDefaultsOnInsert: true, upsert: true }
        );

        // In a real app, send email here
        const inviteLink = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/invite-accept/${token}`;
        
        res.status(201).json({ 
            message: 'Invitation generated successfully', 
            inviteLink // Sending link back for testing/manual invite
        });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// Verify invitation token
router.get('/invite-verify/:token', async (req, res) => {
    try {
        const invitation = await Invitation.findOne({ 
            token: req.params.token, 
            isUsed: false,
            expiresAt: { $gt: new Date() }
        });

        if (!invitation) return res.status(404).json({ message: 'Invalid or expired invitation' });
        res.json({ email: invitation.email, role: invitation.role });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// Complete registration from invite
router.post('/invite-complete', async (req, res) => {
    try {
        const { token, name, password, phone, company } = req.body;
        
        const invitation = await Invitation.findOne({ 
            token, 
            isUsed: false,
            expiresAt: { $gt: new Date() }
        });

        if (!invitation) return res.status(404).json({ message: 'Invalid or expired invitation' });

        // Create user
        const user = new User({
            name,
            email: invitation.email,
            password,
            role: invitation.role,
            status: 'active',
            vendorName: invitation.role === 'vendor' ? company : undefined
        });

        await user.save();

        // Mark invitation as used
        invitation.isUsed = true;
        await invitation.save();

        res.status(201).json({ message: 'Account created successfully', user });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

module.exports = router;
