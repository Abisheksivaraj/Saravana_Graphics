const mongoose = require('mongoose');

const invitationSchema = new mongoose.Schema({
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    role: { type: String, enum: ['admin', 'staff', 'vendor'], default: 'staff' },
    token: { type: String, required: true, unique: true },
    isUsed: { type: Boolean, default: false },
    invitedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    expiresAt: { type: Date, default: () => new Date(+new Date() + 7*24*60*60*1000) } // 7 days
}, { timestamps: true });

module.exports = mongoose.model('Invitation', invitationSchema);
