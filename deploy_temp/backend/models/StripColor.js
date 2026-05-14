const mongoose = require('mongoose');

const stripColorSchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true },
    c: { type: Number, required: true, min: 0, max: 100 },  // Cyan
    m: { type: Number, required: true, min: 0, max: 100 },  // Magenta
    y: { type: Number, required: true, min: 0, max: 100 },  // Yellow
    k: { type: Number, required: true, min: 0, max: 100 },  // Key (Black)
    hex: { type: String, required: true },                    // Computed RGB hex
    isDefault: { type: Boolean, default: false },             // Default colors cannot be deleted
}, { timestamps: true });

// Ensure unique color name (case insensitive)
stripColorSchema.index({ name: 1 }, { unique: true, collation: { locale: 'en', strength: 2 } });

module.exports = mongoose.model('StripColor', stripColorSchema);
