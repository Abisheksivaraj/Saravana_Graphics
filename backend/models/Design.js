const mongoose = require('mongoose');

const elementSchema = new mongoose.Schema({
    id: { type: String, required: true },
    type: {
        type: String,
        enum: ['text', 'rect', 'circle', 'line', 'image', 'barcode', 'qrcode', 'triangle', 'ellipse', 'placeholder'],
        required: true
    },
    x: { type: Number, default: 0 },
    y: { type: Number, default: 0 },
    width: { type: Number },
    height: { type: Number },
    rotation: { type: Number, default: 0 },
    scaleX: { type: Number, default: 1 },
    scaleY: { type: Number, default: 1 },
    // Text properties
    text: { type: String },
    fontSize: { type: Number, default: 16 },
    fontFamily: { type: String, default: 'Arial' },
    fontWeight: { type: String, default: 'normal' },
    fontStyle: { type: String, default: 'normal' },
    textAlign: { type: String, default: 'left' },
    underline: { type: Boolean, default: false },
    // Style properties
    fill: { type: String, default: '#000000' },
    stroke: { type: String, default: 'transparent' },
    strokeWidth: { type: Number, default: 0 },
    opacity: { type: Number, default: 1 },
    // Barcode/QR
    barcodeValue: { type: String },
    barcodeFormat: { type: String, default: 'CODE128' },
    qrValue: { type: String },
    // Image
    src: { type: String },
    // Layer order
    zIndex: { type: Number, default: 0 },
    locked: { type: Boolean, default: false },
    visible: { type: Boolean, default: true },
    name: { type: String, default: '' },
    // New properties for Placeholder and Styling
    fieldName: { type: String, default: '' },
    dash: [{ type: Number }],
    cornerRadius: { type: Number, default: 0 },
    // Shape specific properties
    radius: { type: Number },
    points: [{ type: Number }],
    numPoints: { type: Number },
    innerRadius: { type: Number },
    outerRadius: { type: Number },
    sides: { type: Number },
    data: { type: String }, // For Paths
});

const designSchema = new mongoose.Schema({
    title: { type: String, required: true, trim: true, default: 'Untitled Design' },
    description: { type: String, default: '' },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    // Canvas settings
    canvasWidth: { type: Number, required: true, default: 400 },
    canvasHeight: { type: Number, required: true, default: 600 },
    canvasUnit: { type: String, enum: ['px', 'mm', 'cm', 'in'], default: 'px' },
    backgroundColor: { type: String, default: '#ffffff' },
    backgroundImage: { type: String, default: '' },
    // Preset size info
    sizePreset: { type: String, default: 'custom' },
    // Elements on canvas
    elements: [elementSchema],
    // Company name for grouping/folders
    company: { type: String, trim: true, default: '' },
    // Thumbnail (base64)
    thumbnail: { type: String, default: '' },
    // Tags for searching
    tags: [{ type: String }],
    isTemplate: { type: Boolean, default: false },
    isPublic: { type: Boolean, default: false },
}, { timestamps: true });

module.exports = mongoose.model('Design', designSchema);
