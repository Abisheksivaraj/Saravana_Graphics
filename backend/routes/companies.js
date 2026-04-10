const express = require('express');
const Company = require('../models/Company');
const Design = require('../models/Design');
const auth = require('../middleware/auth');

const router = express.Router();

// Get all companies for logged in user
router.get('/', auth, async (req, res) => {
    try {
        const companies = await Company.find({ userId: req.user._id }).sort({ name: 1 });
        res.json({ companies });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// Create company (folder)
router.post('/', auth, async (req, res) => {
    try {
        const { name, logo, description, tags } = req.body;
        const exists = await Company.findOne({ name, userId: req.user._id });
        if (exists) return res.status(400).json({ message: 'Folder already exists' });

        const company = new Company({
            name,
            logo,
            description,
            tags: tags || [],
            userId: req.user._id,
        });
        await company.save();
        res.status(201).json({ company });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// Delete company
router.delete('/:id', auth, async (req, res) => {
    try {
        const company = await Company.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
        if (!company) return res.status(404).json({ message: 'Folder not found' });
        
        // Optional: Update designs to have no company or delete them
        // For now, just set company to '' for safety
        await Design.updateMany({ company: company.name, userId: req.user._id }, { company: '' });
        
        res.json({ message: 'Folder deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

module.exports = router;
