const express = require('express');
const Design = require('../models/Design');
const auth = require('../middleware/auth');

const router = express.Router();

// ── Helper: compute usedComponents summary from elements array ──
function computeUsedComponents(elements) {
    if (!elements || elements.length === 0) return [];
    const map = {};
    elements.forEach(el => {
        const t = el.type || 'unknown';
        if (!map[t]) map[t] = { type: t, count: 0, names: [] };
        map[t].count++;
        if (el.name) map[t].names.push(el.name);
    });
    return Object.values(map);
}

// Get all designs for logged in user
router.get('/', auth, async (req, res) => {
    try {
        const { page = 1, limit = 20, search = '', tags } = req.query;
        const query = { userId: req.user._id };
        if (search) query.title = { $regex: search, $options: 'i' };
        if (tags) query.tags = { $in: tags.split(',') };

        const total = await Design.countDocuments(query);
        const designs = await Design.find(query)
            .sort({ updatedAt: -1 })
            .skip((page - 1) * limit)
            .limit(Number(limit))
            .select('-elements'); // Exclude elements for listing (too heavy)

        res.json({ designs, total, page: Number(page), totalPages: Math.ceil(total / limit) });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// Get single design with all elements
router.get('/:id', auth, async (req, res) => {
    try {
        const design = await Design.findOne({ _id: req.params.id, userId: req.user._id });
        if (!design) return res.status(404).json({ message: 'Design not found' });
        res.json({ design });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// Get only the component summary for a design (lightweight)
router.get('/:id/components', auth, async (req, res) => {
    try {
        const design = await Design.findOne(
            { _id: req.params.id, userId: req.user._id }
        ).select('title usedComponents elementCount');
        if (!design) return res.status(404).json({ message: 'Design not found' });
        res.json({
            title: design.title,
            elementCount: design.elementCount,
            usedComponents: design.usedComponents,
        });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// Create design
router.post('/', auth, async (req, res) => {
    try {
        const { title, company, canvasWidth, canvasHeight, canvasUnit, backgroundColor, sizePreset, elements, thumbnail, tags } = req.body;

        // Auto-compute component summary
        const elArray = elements || [];
        const usedComponents = computeUsedComponents(elArray);
        const elementCount = elArray.length;

        const design = new Design({
            title: title || 'Untitled Design',
            company: company || '',
            userId: req.user._id,
            canvasWidth: canvasWidth || 400,
            canvasHeight: canvasHeight || 600,
            canvasUnit: canvasUnit || 'px',
            backgroundColor: backgroundColor || '#ffffff',
            sizePreset: sizePreset || 'custom',
            elements: elArray,
            usedComponents,
            elementCount,
            thumbnail: thumbnail || '',
            tags: tags || [],
        });
        await design.save();
        res.status(201).json({ design });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// Update design (auto-save)
router.put('/:id', auth, async (req, res) => {
    try {
        const design = await Design.findOne({ _id: req.params.id, userId: req.user._id });
        if (!design) return res.status(404).json({ message: 'Design not found' });

        const allowedFields = ['title', 'company', 'canvasWidth', 'canvasHeight', 'canvasUnit', 'backgroundColor',
            'sizePreset', 'elements', 'thumbnail', 'tags', 'description', 'backgroundImage'];
        allowedFields.forEach(field => {
            if (req.body[field] !== undefined) design[field] = req.body[field];
        });

        // Auto-recompute component summary whenever elements change
        if (req.body.elements !== undefined) {
            design.usedComponents = computeUsedComponents(req.body.elements);
            design.elementCount = (req.body.elements || []).length;
        }

        await design.save();
        res.json({ design });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// Duplicate design
router.post('/:id/duplicate', auth, async (req, res) => {
    try {
        const original = await Design.findOne({ _id: req.params.id, userId: req.user._id });
        if (!original) return res.status(404).json({ message: 'Design not found' });

        const duplicate = new Design({
            ...original.toObject(),
            _id: undefined,
            title: `${original.title} (Copy)`,
            createdAt: undefined,
            updatedAt: undefined,
        });
        await duplicate.save();
        res.status(201).json({ design: duplicate });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// Get next title for a company
router.get('/next-title/:company', auth, async (req, res) => {
    try {
        const { company } = req.params;
        const designs = await Design.find({ 
            userId: req.user._id, 
            company: { $regex: new RegExp(`^${company}$`, 'i') } 
        }).select('title');

        const regex = new RegExp(`^${company}_(\\d+)$`, 'i');
        let maxSeq = 0;

        designs.forEach(d => {
            const match = d.title.match(regex);
            if (match) {
                const seq = parseInt(match[1]);
                if (seq > maxSeq) maxSeq = seq;
            } else if (d.title.toLowerCase() === company.toLowerCase()) {
                if (maxSeq < 0) maxSeq = 0; // Just in case
            }
        });

        const nextSeq = String(maxSeq + 1).padStart(2, '0');
        res.json({ nextTitle: `${company}_${nextSeq}` });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// Delete design
router.delete('/:id', auth, async (req, res) => {
    try {
        const design = await Design.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
        if (!design) return res.status(404).json({ message: 'Design deleted successfully' });
        res.json({ message: 'Design deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

module.exports = router;
