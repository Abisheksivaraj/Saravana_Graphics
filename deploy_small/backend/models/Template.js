const mongoose = require('mongoose');

const templateSchema = new mongoose.Schema({
    title: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    category: {
        type: String,
        enum: ['price-tag', 'business-card', 'label', 'barcode-label', 'clothing-tag', 'shipping-label', 'custom'],
        default: 'custom'
    },
    canvasWidth: { type: Number, required: true },
    canvasHeight: { type: Number, required: true },
    canvasUnit: { type: String, default: 'px' },
    backgroundColor: { type: String, default: '#ffffff' },
    elements: { type: mongoose.Schema.Types.Mixed, default: [] },
    thumbnail: { type: String, default: '' },
    tags: [{ type: String }],
    isPublic: { type: Boolean, default: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    usageCount: { type: Number, default: 0 },
}, { timestamps: true });

module.exports = mongoose.model('Template', templateSchema);
