const express = require('express');
const StripColor = require('../models/StripColor');
const auth = require('../middleware/auth');

const router = express.Router();

// CMYK to RGB hex conversion
function cmykToHex(c, m, y, k) {
    const r = Math.round(255 * (1 - c / 100) * (1 - k / 100));
    const g = Math.round(255 * (1 - m / 100) * (1 - k / 100));
    const b = Math.round(255 * (1 - y / 100) * (1 - k / 100));
    return '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('').toUpperCase();
}

// Default strip colors (seeded on first request if DB is empty)
const DEFAULT_STRIP_COLORS = [
    { name: 'Blue',   c: 95,  m: 64,  y: 11,  k: 0 },
    { name: 'Red',    c: 0,   m: 100, y: 100, k: 0 },
    { name: 'Orange', c: 0,   m: 60,  y: 100, k: 0 },
    { name: 'Green',  c: 100, m: 0,   y: 100, k: 0 },
    { name: 'Purple', c: 48,  m: 85,  y: 16,  k: 0 },
];

// Seed defaults if none exist
async function seedDefaults() {
    const count = await StripColor.countDocuments();
    if (count === 0) {
        const docs = DEFAULT_STRIP_COLORS.map(color => ({
            ...color,
            hex: cmykToHex(color.c, color.m, color.y, color.k),
            isDefault: true,
        }));
        await StripColor.insertMany(docs);
        console.log('✅ Default strip colors seeded');
    }
}

// GET all strip colors (public - no auth needed for layout rendering)
router.get('/', async (req, res) => {
    try {
        await seedDefaults();
        const colors = await StripColor.find().sort({ isDefault: -1, name: 1 });
        res.json({ colors });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// POST - Add a new strip color (auth required)
router.post('/', auth, async (req, res) => {
    try {
        const { name, c, m, y, k } = req.body;

        if (!name || name.trim() === '') {
            return res.status(400).json({ message: 'Color name is required' });
        }
        if ([c, m, y, k].some(v => v === undefined || v === null || v < 0 || v > 100)) {
            return res.status(400).json({ message: 'CMYK values must be between 0 and 100' });
        }

        // Check for duplicate name
        const exists = await StripColor.findOne({ name: { $regex: new RegExp(`^${name.trim()}$`, 'i') } });
        if (exists) {
            return res.status(400).json({ message: `Strip color "${name}" already exists` });
        }

        const hex = cmykToHex(c, m, y, k);
        const color = new StripColor({
            name: name.trim(),
            c: Math.round(c),
            m: Math.round(m),
            y: Math.round(y),
            k: Math.round(k),
            hex,
            isDefault: false,
        });
        await color.save();
        res.status(201).json({ color });
    } catch (error) {
        if (error.code === 11000) {
            return res.status(400).json({ message: 'Strip color name already exists' });
        }
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// PUT - Update a strip color (auth required)
router.put('/:id', auth, async (req, res) => {
    try {
        const { name, c, m, y, k } = req.body;
        const color = await StripColor.findById(req.params.id);
        if (!color) return res.status(404).json({ message: 'Strip color not found' });

        if (name) color.name = name.trim();
        if (c !== undefined) color.c = Math.round(c);
        if (m !== undefined) color.m = Math.round(m);
        if (y !== undefined) color.y = Math.round(y);
        if (k !== undefined) color.k = Math.round(k);
        color.hex = cmykToHex(color.c, color.m, color.y, color.k);

        await color.save();
        res.json({ color });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// DELETE - Remove a custom strip color (cannot delete defaults)
router.delete('/:id', auth, async (req, res) => {
    try {
        const color = await StripColor.findById(req.params.id);
        if (!color) return res.status(404).json({ message: 'Strip color not found' });
        if (color.isDefault) {
            return res.status(400).json({ message: 'Cannot delete default strip colors' });
        }

        await StripColor.findByIdAndDelete(req.params.id);
        res.json({ message: 'Strip color deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

module.exports = router;
