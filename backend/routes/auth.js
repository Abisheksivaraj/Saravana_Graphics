const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const auth = require('../middleware/auth');

const router = express.Router();

const generateToken = (userId) => {
    return jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: '7d' });
};

// Register
router.post('/register', async (req, res) => {
    try {
        const { name, email, password } = req.body;
        if (!name || !email || !password)
            return res.status(400).json({ message: 'All fields are required' });
        if (password.length < 6)
            return res.status(400).json({ message: 'Password must be at least 6 characters' });

        const existingUser = await User.findOne({ email });
        if (existingUser)
            return res.status(400).json({ message: 'Email already registered' });

        const user = new User({ name, email, password });
        await user.save();

        const token = generateToken(user._id);
        res.status(201).json({ token, user });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// Login
router.post('/login', async (req, res) => {
    try {
        const { identifier, password } = req.body;
        if (!identifier || !password)
            return res.status(400).json({ message: 'Identifier (email/username) and password are required' });

        // Search for user by email OR username
        const user = await User.findOne({
            $or: [
                { email: identifier.toLowerCase() },
                { username: identifier.toLowerCase() }
            ]
        });

        if (!user)
            return res.status(401).json({ message: 'Invalid credentials' });

        const isMatch = await user.comparePassword(password);
        if (!isMatch)
            return res.status(401).json({ message: 'Invalid credentials' });

        const token = generateToken(user._id);
        res.json({ token, user });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// Get current user
router.get('/me', auth, async (req, res) => {
    res.json({ user: req.user });
});

// Update profile
router.put('/profile', auth, async (req, res) => {
    try {
        const { name, avatar } = req.body;
        const user = await User.findByIdAndUpdate(
            req.user._id,
            { name, avatar },
            { new: true, runValidators: true }
        ).select('-password');
        res.json({ user });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

module.exports = router;
