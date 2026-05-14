const mongoose = require('mongoose');

const vendorOrderSchema = new mongoose.Schema({
    orderId: { type: String, required: true, unique: true },
    vendorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Vendor', required: true },
    vendorCode: { type: String, trim: true },
    barcodeFileId: { type: String, trim: true },
    fileName: { type: String, required: true },
    filePath: { type: String, required: true },
    brand: { type: String, trim: true },
    brandName: { type: String, trim: true },
    manualBrand: { type: String, trim: true },
    groupName: { type: String, trim: true },
    adminQuantity: { type: String, trim: true, default: '' },
    status: {
        type: String,
        enum: [
            'Excel Uploaded',
            'Layout Uploaded',
            'Artwork Rejected',
            'Revised Artwork Uploaded',
            'Artwork Approved',
            'Performa Invoice Uploaded',
            'Performa Invoice Approved',
            'Payment Proof Uploaded',
            'Check Uploaded',
            'Production',

            'Delivered',
            'Completed',
            'Cancelled'
        ],
        default: 'Excel Uploaded'
    },
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, required: true, refPath: 'uploaderModel' },
    uploaderModel: { type: String, required: true, enum: ['User', 'Vendor'], default: 'Vendor' },
    remarks: { type: String, default: '' },
    layoutFileUrl: { type: String },
    layoutHistory: [{
        version: { type: Number },
        fileUrl: { type: String },
        uploadedAt: { type: Date, default: Date.now },
        uploadedBy: { type: String, default: 'Admin' }
    }],
    revisedArtworkUrl: { type: String },
    revisedArtworkHistory: [{
        version: { type: Number },
        fileUrl: { type: String },
        uploadedAt: { type: Date, default: Date.now },
        uploadedBy: { type: String, default: 'Vendor' }
    }],
    reviewHistory: [{
        status: { type: String },
        remarks: { type: String },
        reviewedAt: { type: Date, default: Date.now },
        reviewedBy: { type: String }
    }],
    performaInvoiceUrl: { type: String },
    performaInvoiceDate: { type: Date },
    performaInvoiceApprovedDate: { type: Date },
    paymentSubmittedDate: { type: Date },
    deliveryProofUrl: { type: String },
    deliveryRemarks: { type: String },
    deliveryDate: { type: Date },
    productionDate: { type: Date },
    productionStartDate: { type: Date },
    productionStartComment: { type: String, default: '' },
    isProductionStarted: { type: Boolean, default: false },
    dispatchDate: { type: Date },
    paymentDetails: {
        amountPaid: { type: Number },
        tdsApplicable: { type: Boolean, default: false },
        paymentMode: { type: String, enum: ['PDC', 'NEFT/RTGS', 'UPI'], default: 'PDC' },
        chequeNumber: { type: String },
        chequeScanUrl: { type: String },
        chequeDate: { type: Date },
        dispatchedBy: { type: String },
        trackingNumber: { type: String },
        trackingScanUrl: { type: String },
        deliveryDate: { type: Date },
        purchaseOrders: { type: String },
        purchaseOrdersUrl: { type: String },
        remarks: { type: String }
    },
    paymentHistory: [{
        amountPaid: { type: Number },
        tdsApplicable: { type: Boolean, default: false },
        paymentMode: { type: String, enum: ['PDC', 'NEFT/RTGS', 'UPI'], default: 'PDC' },
        chequeNumber: { type: String },
        chequeScanUrl: { type: String },
        chequeDate: { type: Date },
        dispatchedBy: { type: String },
        trackingNumber: { type: String },
        trackingScanUrl: { type: String },
        deliveryDate: { type: Date },
        purchaseOrders: { type: String },
        purchaseOrdersUrl: { type: String },
        remarks: { type: String },
        submittedAt: { type: Date, default: Date.now }
    }]
}, { timestamps: true });

// Index for performance
vendorOrderSchema.index({ vendorId: 1, status: 1 });

module.exports = mongoose.model('VendorOrder', vendorOrderSchema);
