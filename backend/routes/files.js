const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const SavedFile = require('../models/SavedFile');
const auth = require('../middleware/auth');

// Ensure uploads/files directory exists
const uploadDir = path.join(__dirname, '../uploads/files');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

// Set up storage engine
const storage = multer.diskStorage({
    destination: function(req, file, cb) {
        cb(null, uploadDir);
    },
    filename: function(req, file, cb) {
        cb(null, 'proofsheet-' + Date.now() + path.extname(file.originalname));
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 50 * 1024 * 1024 } // 50MB limit for PDFs
});

// @route   POST /api/files/upload
// @desc    Upload a proof sheet file
// @access  Private
router.post('/upload', auth, upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'No file uploaded' });
        }

        const newFile = new SavedFile({
            filename: req.file.filename,
            originalName: req.file.originalname,
            url: `/uploads/files/${req.file.filename}`,
            uploadedBy: req.user.id
        });

        await newFile.save();
        res.status(201).json(newFile);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

// @route   GET /api/files
// @desc    Get all saved files
// @access  Private (Admin only)
router.get('/', auth, async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ message: 'Access denied' });
        }
        const files = await SavedFile.find().sort({ createdAt: -1 }).populate('uploadedBy', 'name email');
        res.json(files);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

// @route   DELETE /api/files/:id
// @desc    Delete a saved file
// @access  Private (Admin only)
router.delete('/:id', auth, async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ message: 'Access denied' });
        }

        const fileDoc = await SavedFile.findById(req.params.id);
        if (!fileDoc) {
            return res.status(404).json({ message: 'File not found' });
        }

        const filePath = path.join(__dirname, '../uploads/files', fileDoc.filename);
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }

        await SavedFile.findByIdAndDelete(req.params.id);
        res.json({ message: 'File deleted' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;
