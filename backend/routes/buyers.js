const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const User = require('../models/User');
const VendorOrder = require('../models/VendorOrder');
const Vendor = require('../models/Vendor');
const sendAccountCreationEmail = require('../utils/sendEmail');

// Role middleware
const checkRole = (roles) => (req, res, next) => {
    if (!roles.includes(req.user.role)) {
        return res.status(403).json({ message: 'Access denied: Insufficient permissions' });
    }
    next();
};

// @route   POST api/buyers/account
// @desc    Create a new Buyer account
// @access  Admin
router.post('/account', auth, checkRole(['admin']), async (req, res) => {
    try {
        const { name, email, username, password, companyName, assignedVendors } = req.body;
        
        const existingUser = await User.findOne({ $or: [{ email }, { username }] });
        if (existingUser) return res.status(400).json({ message: 'Buyer with this email or username already exists' });
        
        const user = new User({
            name, email, username, password, companyName, assignedVendors, role: 'buyer'
        });
        
        await user.save();
        
        // Send email notification
        await sendAccountCreationEmail(email, 'buyer', 'N/A', username, password);
        
        res.status(201).json({ message: 'Buyer account created', user });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// @route   GET api/buyers/accounts
// @desc    List all buyer accounts
// @access  Admin
router.get('/accounts', auth, checkRole(['admin']), async (req, res) => {
    try {
        const buyers = await User.find({ role: 'buyer' }).select('-password').populate('assignedVendors', 'name vendorName vendorCode');
        res.json(buyers);
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// @route   GET api/buyers/vendors
// @desc    List vendors assigned to the logged-in buyer
// @access  Buyer
router.get('/vendors', auth, checkRole(['buyer']), async (req, res) => {
    try {
        const buyer = await User.findById(req.user._id).populate('assignedVendors', 'name vendorName vendorCode email status');
        if (!buyer) return res.status(404).json({ message: 'Buyer not found' });
        
        res.json(buyer.assignedVendors);
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// @route   GET api/buyers/vendor-history/:vendorId
// @desc    Get detailed history for a specific vendor
// @access  Buyer/Admin
router.get('/vendor-history/:vendorId', auth, checkRole(['buyer', 'admin']), async (req, res) => {
    try {
        const vendorId = req.params.vendorId;
        
        // Security check for buyers: must be assigned to this vendor
        if (req.user.role === 'buyer') {
            const buyer = await User.findById(req.user._id);
            if (!buyer.assignedVendors.includes(vendorId)) {
                return res.status(403).json({ message: 'Access denied: Vendor not assigned to you' });
            }
        }
        
        const vendor = await Vendor.findById(vendorId).select('name vendorName vendorCode email');
        if (!vendor) return res.status(404).json({ message: 'Vendor not found' });
        
        const orders = await VendorOrder.find({ vendorId }).sort({ createdAt: -1 });
        
        res.json({ vendor, orders });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

module.exports = router;
