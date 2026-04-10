const express = require('express');
const Template = require('../models/Template');
const Design = require('../models/Design');
const auth = require('../middleware/auth');

const router = express.Router();

// Get all public templates
router.get('/', async (req, res) => {
    try {
        const { category, search, page = 1, limit = 20 } = req.query;
        const query = { isPublic: true };
        if (category && category !== 'all') query.category = category;
        if (search) query.title = { $regex: search, $options: 'i' };

        const total = await Template.countDocuments(query);
        const templates = await Template.find(query)
            .sort({ usageCount: -1, createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(Number(limit))
            .select('-elements');

        res.json({ templates, total, page: Number(page), totalPages: Math.ceil(total / limit) });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// Get single template with elements
router.get('/:id', async (req, res) => {
    try {
        const template = await Template.findById(req.params.id);
        if (!template) return res.status(404).json({ message: 'Template not found' });
        template.usageCount += 1;
        await template.save();
        res.json({ template });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// Create template from design (auth required)
router.post('/', auth, async (req, res) => {
    try {
        const { title, description, category, designId, tags } = req.body;
        let elements = req.body.elements || [];
        let canvasWidth = req.body.canvasWidth;
        let canvasHeight = req.body.canvasHeight;
        let backgroundColor = req.body.backgroundColor || '#ffffff';
        let thumbnail = req.body.thumbnail || '';

        // If designId provided, copy from design
        if (designId) {
            const design = await Design.findOne({ _id: designId, userId: req.user._id });
            if (!design) return res.status(404).json({ message: 'Design not found' });
            elements = design.elements;
            canvasWidth = design.canvasWidth;
            canvasHeight = design.canvasHeight;
            backgroundColor = design.backgroundColor;
            thumbnail = design.thumbnail;
        }

        const template = new Template({
            title, description, category: category || 'custom',
            canvasWidth, canvasHeight, backgroundColor,
            elements, thumbnail, tags: tags || [],
            isPublic: true,
            createdBy: req.user._id,
        });
        await template.save();
        res.status(201).json({ template });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// Seed default templates (admin only - run once)
router.post('/seed', auth, async (req, res) => {
    try {
        const count = await Template.countDocuments();
        if (count > 0) return res.json({ message: 'Templates already seeded', count });

        const defaultTemplates = [
            {
                title: 'Price Tag',
                description: 'Standard retail price tag with MRP and barcode',
                category: 'price-tag',
                canvasWidth: 200,
                canvasHeight: 300,
                backgroundColor: '#ffffff',
                isPublic: true,
                tags: ['retail', 'price', 'tag'],
                elements: [],
            },
            {
                title: 'Business Card',
                description: 'Professional business card layout',
                category: 'business-card',
                canvasWidth: 350,
                canvasHeight: 200,
                backgroundColor: '#1a1a2e',
                isPublic: true,
                tags: ['business', 'card', 'professional'],
                elements: [],
            },
            {
                title: 'Shipping Label',
                description: 'Standard shipping label with barcode',
                category: 'shipping-label',
                canvasWidth: 400,
                canvasHeight: 250,
                backgroundColor: '#ffffff',
                isPublic: true,
                tags: ['shipping', 'logistics', 'barcode'],
                elements: [],
            },
            {
                title: 'Clothing Tag',
                description: 'Apparel clothing tag with size info',
                category: 'clothing-tag',
                canvasWidth: 180,
                canvasHeight: 350,
                backgroundColor: '#ffffff',
                isPublic: true,
                tags: ['clothing', 'apparel', 'garment'],
                elements: [],
            },
        ];

        await Template.insertMany(defaultTemplates);
        res.json({ message: 'Templates seeded successfully', count: defaultTemplates.length });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

module.exports = router;
