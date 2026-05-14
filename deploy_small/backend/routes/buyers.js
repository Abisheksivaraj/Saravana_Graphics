const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const User = require('../models/User');
const VendorOrder = require('../models/VendorOrder');
const Vendor = require('../models/Vendor');
const { sendAccountCreationEmail } = require('../utils/sendEmail');

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
        const { email, companyName, assignedGroup } = req.body;
        const name = assignedGroup; // Mapped to satisfy the User schema requirement
        
        const existingUser = await User.findOne({ email });
        if (existingUser) return res.status(400).json({ message: 'Buyer with this email already exists' });
        
        // Auto-generate credentials
        const username = `buyer_${Math.floor(10000 + Math.random() * 90000)}`;
        const password = Math.random().toString(36).slice(-8) + Math.floor(Math.random() * 10); // Ensure some numbers
        
        const user = new User({
            name, email, username, password, companyName, assignedGroup, role: 'buyer'
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
        
        let assignedVendors = [];
        if (buyer.assignedGroup) {
            // Find vendors that have this groupName
            assignedVendors = await Vendor.find({ groupNames: buyer.assignedGroup })
                .select('name vendorName vendorCode email status');
        } else if (buyer.assignedVendors && buyer.assignedVendors.length > 0) {
            // Fallback for legacy buyers
            assignedVendors = buyer.assignedVendors;
        }
        
        res.json(assignedVendors);
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
        
        const vendor = await Vendor.findById(vendorId).select('name vendorName vendorCode email groupNames');
        if (!vendor) return res.status(404).json({ message: 'Vendor not found' });
        
        // Security check for buyers: must be assigned to this vendor's group or directly
        if (req.user.role === 'buyer') {
            const buyer = await User.findById(req.user._id);
            const hasGroupAccess = buyer.assignedGroup && vendor.groupNames && vendor.groupNames.includes(buyer.assignedGroup);
            const hasDirectAccess = buyer.assignedVendors && buyer.assignedVendors.includes(vendorId);
            
            if (!hasGroupAccess && !hasDirectAccess) {
                return res.status(403).json({ message: 'Access denied: Vendor not assigned to you' });
            }
        }
        
        const orders = await VendorOrder.find({ vendorId }).sort({ createdAt: -1 });
        
        res.json({ vendor, orders });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

module.exports = router;
