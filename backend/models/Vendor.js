const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const vendorSchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    username: { type: String, unique: true, sparse: true, lowercase: true, trim: true },
    password: { type: String, required: true, minlength: 6 },
    avatar: { type: String, default: '' },
    role: { type: String, default: 'vendor' },
    status: { type: String, enum: ['active', 'pending', 'suspended'], default: 'active' },
    adminCode: { type: String, sparse: true, trim: true },
    vendorCode: { type: String, unique: true, sparse: true },
    vendorGstin: { type: String },
    vendorName: { type: String },
    vendorBrand: { type: String },
    address: { type: String, trim: true, default: '' },
    groupNames: [{ type: String, trim: true }],
    isFirstLogin: { type: Boolean, default: true },
    otp: { type: String },
    otpExpires: { type: Date },
    entities: [{
        vendorCode: { type: String, trim: true },
        vendorName: { type: String, trim: true },
        brandName: { type: String, trim: true },
        vendorGstin: { type: String, trim: true },
        vendorBrand: { type: String, trim: true },
        groupName: { type: String, trim: true }
    }]
}, { timestamps: true });

vendorSchema.pre('save', async function (next) {
    if (!this.isModified('password')) return next();
    this.password = await bcrypt.hash(this.password, 12);
    next();
});

vendorSchema.methods.comparePassword = async function (candidatePassword) {
    return bcrypt.compare(candidatePassword, this.password);
};

vendorSchema.methods.toJSON = function () {
    const obj = this.toObject();
    delete obj.password;
    return obj;
};

module.exports = mongoose.model('Vendor', vendorSchema);
