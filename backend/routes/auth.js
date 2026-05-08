const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Vendor = require('../models/Vendor');
const auth = require('../middleware/auth');
const { sendOtpEmail } = require('../utils/sendEmail');
const crypto = require('crypto');

const router = express.Router();

const generateToken = (userId) => {
    return jwt.sign({ userId: userId.toString() }, process.env.JWT_SECRET, { expiresIn: '7d' });
};

// Register
router.post('/register', async (req, res) => {
    try {
        const { name, email, password } = req.body;
        if (!name || !email || !password)
            return res.status(400).json({ message: 'All fields are required' });
        if (password.length < 6)
            return res.status(400).json({ message: 'Password must be at least 6 characters' });

        const existingUser = await User.findOne({ email: email.toLowerCase() });
        const existingVendor = await Vendor.findOne({ email: email.toLowerCase() });
        if (existingUser || existingVendor)
            return res.status(400).json({ message: 'Email already registered' });

        const user = new User({ name, email: email.toLowerCase(), password });
        await user.save();

        const token = generateToken(user._id);
        res.status(201).json({ token, user });
    } catch (error) {
        console.error('REGISTER ERROR:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// Login
router.post('/login', async (req, res) => {
    try {
        const { identifier, password } = req.body;
        if (!identifier || !password)
            return res.status(400).json({ message: 'Identifier and password are required' });

        const searchId = typeof identifier === 'string' ? identifier.toLowerCase() : identifier;

        const query = {
            $or: [
                { email: searchId },
                { username: searchId }
            ]
        };

        let user = await User.findOne(query);
        if (!user) user = await Vendor.findOne(query);

        if (!user) return res.status(401).json({ message: 'Invalid credentials' });

        const isMatch = await user.comparePassword(password);
        if (!isMatch) return res.status(401).json({ message: 'Invalid credentials' });

        if (!process.env.JWT_SECRET) {
            console.error('CRITICAL ERROR: JWT_SECRET is not defined in .env');
            return res.status(500).json({ message: 'Server configuration error' });
        }

        const token = generateToken(user._id);
        
        console.log(`User logged in: ${user.email} (Role: ${user.role})`);

        const userObj = {
            _id: user._id,
            name: user.name,
            email: user.email,
            username: user.username,
            role: user.role,
            avatar: user.avatar,
            isFirstLogin: user.role === 'vendor' ? (user.isFirstLogin || false) : false
        };

        res.json({ 
            token, 
            user: userObj
        });
    } catch (error) {
        console.error('LOGIN ERROR DETAIL:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// Forgot Password - Send OTP
router.post('/forgot-password', async (req, res) => {
    try {
        const { email } = req.body;
        let user = await Vendor.findOne({ email: email.toLowerCase() });
        if (!user) return res.status(404).json({ message: 'No account found with this email' });

        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        user.otp = otp;
        user.otpExpires = Date.now() + 10 * 60 * 1000; // 10 mins
        await user.save();

        await sendOtpEmail(email, otp);
        res.json({ message: 'OTP sent to your email' });
    } catch (err) {
        console.error('FORGOT PWD ERROR:', err);
        res.status(500).json({ message: 'Server error' });
    }
});

// Verify OTP
router.post('/verify-otp', async (req, res) => {
    try {
        const { email, otp } = req.body;
        const user = await Vendor.findOne({ 
            email: email.toLowerCase(), 
            otp, 
            otpExpires: { $gt: Date.now() } 
        });

        if (!user) return res.status(400).json({ message: 'Invalid or expired OTP' });
        res.json({ message: 'OTP verified' });
    } catch (err) {
        res.status(500).json({ message: 'Server error' });
    }
});

// Reset Password after OTP
router.post('/reset-password', async (req, res) => {
    try {
        const { email, otp, newPassword } = req.body;
        const user = await Vendor.findOne({ 
            email: email.toLowerCase(), 
            otp, 
            otpExpires: { $gt: Date.now() } 
        });

        if (!user) return res.status(400).json({ message: 'Session expired. Please try again.' });

        user.password = newPassword;
        user.otp = undefined;
        user.otpExpires = undefined;
        user.isFirstLogin = false;
        await user.save();

        res.json({ message: 'Password reset successful' });
    } catch (err) {
        res.status(500).json({ message: 'Server error' });
    }
});

// First Login - Update Credentials
router.post('/update-credentials', auth, async (req, res) => {
    try {
        const { username, password } = req.body;
        const user = await Vendor.findById(req.user._id);
        if (!user) return res.status(404).json({ message: 'User not found' });

        if (username) user.username = username.toLowerCase();
        if (password) user.password = password;
        
        user.isFirstLogin = false;
        await user.save();

        res.json({ message: 'Credentials updated successfully', user });
    } catch (err) {
        res.status(500).json({ message: 'Server error' });
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
