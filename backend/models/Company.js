const mongoose = require('mongoose');

const companySchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    logo: { type: String, default: '' },
    description: { type: String, default: '' },
    tags: [{ type: String }],
}, { timestamps: true });

// Ensure unique company name per user
companySchema.index({ name: 1, userId: 1 }, { unique: true });

module.exports = mongoose.model('Company', companySchema);
