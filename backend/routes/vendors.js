const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const auth = require('../middleware/auth');
const VendorOrder = require('../models/VendorOrder');
const User = require('../models/User');
const Message = require('../models/Message');

// Multer storage config
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dir = 'uploads/vendor-files';
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'vendor-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({ 
    storage,
    fileFilter: (req, file, cb) => {
        const allowedExts = ['.xlsx', '.xls', '.pdf', '.png', '.jpg', '.jpeg'];
        if (allowedExts.includes(path.extname(file.originalname).toLowerCase())) {
            cb(null, true);
        } else {
            cb(new Error('Invalid file type. Only Excel, PDF, and Image files are allowed.'));
        }
    }
});

// Role middleware
const checkRole = (roles) => (req, res, next) => {
    if (!roles.includes(req.user.role)) {
        return res.status(403).json({ message: 'Access denied: Insufficient permissions' });
    }
    next();
};

// @route   POST api/vendors/upload
// @desc    Upload order file
// @access  Vendor
router.post('/upload', auth, checkRole(['vendor', 'admin']), upload.single('file'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ message: 'No file uploaded' });

        const orderId = 'ORD-' + Math.floor(100000 + Math.random() * 900000);
        
        const newOrder = new VendorOrder({
            orderId,
            vendorId: req.user._id,
            barcodeFileId: req.body.barcodeFileId || '',
            fileName: req.file.originalname,
            filePath: req.file.path,
            brand: req.body.brand || 'General',
            uploadedBy: req.user._id,
            status: 'Queued'
        });

        await newOrder.save();
        res.status(201).json({ 
            message: 'File Uploaded Successfully',
            orderId: newOrder.orderId,
            order: newOrder 
        });
    } catch (error) {
        res.status(500).json({ message: 'Upload failed', error: error.message });
    }
});

// @route   GET api/vendors/orders
// @desc    Get orders (Vendor sees own, Admin sees all)
// @access  Vendor/Admin
router.get('/orders', auth, async (req, res) => {
    try {
        const query = req.user.role === 'admin' ? {} : { vendorId: req.user._id };
        const orders = await VendorOrder.find(query).sort({ createdAt: -1 }).populate('vendorId', 'name vendorCode');
        res.json(orders);
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// @route   GET api/vendors/stats
// @desc    Get dashboard stats
// @access  Vendor/Admin
router.get('/stats', auth, async (req, res) => {
    try {
        const query = req.user.role === 'admin' ? {} : { vendorId: req.user._id };
        const orders = await VendorOrder.find(query);
        const stats = {
            Queued: 0,
            Reject: 0,
            Verification: 0,
            'Artwork Approval': 0,
            Production: 0,
            Despatch: 0,
            APPROVED: 0,
            TotalFile: orders.length
        };

        orders.forEach(order => {
            if (stats[order.status] !== undefined) stats[order.status]++;
        });

        res.json(stats);
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// @route   PATCH api/vendors/status/:id
// @desc    Update order status
// @access  Admin
router.patch('/status/:id', auth, checkRole(['admin', 'vendor']), async (req, res) => {
    try {
        const { status, remarks, productionDate, dispatchDate } = req.body;
        const query = req.user.role === 'admin' ? { _id: req.params.id } : { _id: req.params.id, vendorId: req.user._id };
        const update = { status, remarks };
        if (productionDate !== undefined) update.productionDate = productionDate || null;
        if (dispatchDate !== undefined) update.dispatchDate = dispatchDate || null;
        const order = await VendorOrder.findOneAndUpdate(query, update, { new: true });
        if (!order) return res.status(404).json({ message: 'Order not found or unauthorized' });
        res.json(order);
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// @route   POST api/vendors/layout/:id
// @desc    Upload layout file for an order
// @access  Admin
router.post('/layout/:id', auth, checkRole(['admin']), upload.single('file'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ message: 'No file uploaded' });
        
        const order = await VendorOrder.findByIdAndUpdate(
            req.params.id,
            { layoutFileUrl: req.file.path, status: 'Layout Uploaded' },
            { new: true }
        );
        if (!order) return res.status(404).json({ message: 'Order not found' });
        
        res.json({ message: 'Layout uploaded', order });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// @route   POST api/vendors/revised-artwork/:id
// @desc    Upload revised artwork for an order
// @access  Vendor
router.post('/revised-artwork/:id', auth, checkRole(['vendor']), upload.single('file'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ message: 'No file uploaded' });
        
        const order = await VendorOrder.findOneAndUpdate(
            { _id: req.params.id, vendorId: req.user._id },
            { revisedArtworkUrl: req.file.path, status: 'Revised Artwork Uploaded' },
            { new: true }
        );
        if (!order) return res.status(404).json({ message: 'Order not found' });
        
        res.json({ message: 'Revised artwork uploaded', order });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// @route   POST api/vendors/performa-invoice/:id
// @desc    Upload performa invoice for an order
// @access  Admin
router.post('/performa-invoice/:id', auth, checkRole(['admin']), upload.single('file'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ message: 'No file uploaded' });
        
        const order = await VendorOrder.findByIdAndUpdate(
            req.params.id,
            { performaInvoiceUrl: req.file.path, status: 'Performa Invoice Uploaded' },
            { new: true }
        );
        if (!order) return res.status(404).json({ message: 'Order not found' });
        
        res.json({ message: 'Performa invoice uploaded', order });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// @route   PATCH api/vendors/dates/:id
// @desc    Update production and dispatch dates
// @access  Vendor
router.patch('/dates/:id', auth, checkRole(['vendor']), async (req, res) => {
    try {
        const { productionDate, dispatchDate } = req.body;
        const order = await VendorOrder.findById(req.params.id);
        if(!order || order.vendorId.toString() !== req.user._id.toString()) {
            return res.status(404).json({ message: 'Order not found' });
        }
        
        order.productionDate = productionDate;
        order.dispatchDate = dispatchDate;
        if(order.status === 'Artwork Approved') {
             order.status = 'Production';
        }
        await order.save();
        res.json(order);
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// @route   POST api/vendors/account
// @desc    Create a new Vendor account
// @access  Admin
router.post('/account', auth, checkRole(['admin']), async (req, res) => {
    try {
         const { name, email, username, password, vendorCode, vendorGstin, vendorName } = req.body;
         const existingUser = await User.findOne({ $or: [{ email }, { username }, { vendorCode }] });
         if(existingUser) return res.status(400).json({ message: 'User with this email, username, or vendorCode already exists' });
         
         const user = new User({
             name, email, username, password, vendorCode, vendorGstin, vendorName, role: 'vendor'
         });
         await user.save();
         res.status(201).json({ message: 'Vendor added', user });
    } catch (error) {
         res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// @route   GET api/vendors/accounts
// @desc    List all vendor accounts
// @access  Admin
router.get('/accounts', auth, checkRole(['admin']), async (req, res) => {
    try {
        const vendors = await User.find({ role: 'vendor' }).select('-password');
        res.json(vendors);
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// @route   POST api/vendors/payment/:id
// @desc    Submit payment acknowledgement details
// @access  Vendor
router.post('/payment/:id', auth, checkRole(['vendor']), upload.fields([
    { name: 'chequeScanImage', maxCount: 1 },
    { name: 'trackingScanCopy', maxCount: 1 },
    { name: 'purchaseOrderCopy', maxCount: 1 }
]), async (req, res) => {
    try {
        const order = await VendorOrder.findById(req.params.id);
        if(!order || order.vendorId.toString() !== req.user._id.toString()) {
            return res.status(404).json({ message: 'Order not found' });
        }

        const data = req.body;
        
        // Parse fields
        const paymentDetails = {
            amountPaid: data.amountPaid ? Number(data.amountPaid) : undefined,
            tdsApplicable: data.tdsApplicable === 'true',
            paymentMode: data.paymentMode || 'PDC',
            chequeNumber: data.chequeNumber,
            chequeDate: data.chequeDate ? new Date(data.chequeDate) : undefined,
            dispatchedBy: data.dispatchedBy,
            trackingNumber: data.trackingNumber,
            deliveryDate: data.deliveryDate ? new Date(data.deliveryDate) : undefined,
            purchaseOrders: data.purchaseOrders,
            remarks: data.remarks
        };

        // Attach file URLs
        if (req.files) {
            if (req.files.chequeScanImage && req.files.chequeScanImage[0]) {
                paymentDetails.chequeScanUrl = req.files.chequeScanImage[0].path.replace(/\\/g, '/');
            }
            if (req.files.trackingScanCopy && req.files.trackingScanCopy[0]) {
                paymentDetails.trackingScanUrl = req.files.trackingScanCopy[0].path.replace(/\\/g, '/');
            }
            if (req.files.purchaseOrderCopy && req.files.purchaseOrderCopy[0]) {
                paymentDetails.purchaseOrdersUrl = req.files.purchaseOrderCopy[0].path.replace(/\\/g, '/');
            }
        }

        order.paymentDetails = paymentDetails;
        order.status = 'Payment Follow-up'; // Or remain Despatch depending on semantics
        await order.save();

        res.json({ message: 'Payment details submitted successfully', order });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// @route   GET api/vendors/chat/:orderId
// @desc    Get chat messages for an order
// @access  Vendor/Admin
router.get('/chat/:orderId', auth, async (req, res) => {
    try {
        const order = await VendorOrder.findById(req.params.orderId);
        if (!order) return res.status(404).json({ message: 'Order not found' });

        // Security check: Vendor can only see messages for their own order
        if (req.user.role === 'vendor' && order.vendorId.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: 'Unauthorized' });
        }

        const messages = await Message.find({ orderId: req.params.orderId })
            .sort({ createdAt: 1 })
            .populate('sender', 'name');
            
        res.json(messages);
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// @route   POST api/vendors/chat/:orderId
// @desc    Send a chat message
// @access  Vendor/Admin
router.post('/chat/:orderId', auth, async (req, res) => {
    try {
        const { text } = req.body;
        const order = await VendorOrder.findById(req.params.orderId);
        if (!order) return res.status(404).json({ message: 'Order not found' });

        if (req.user.role === 'vendor' && order.vendorId.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: 'Unauthorized' });
        }

        const newMessage = new Message({
            orderId: req.params.orderId,
            sender: req.user._id,
            text,
            role: req.user.role
        });

        await newMessage.save();
        res.status(201).json(newMessage);
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

module.exports = router;
