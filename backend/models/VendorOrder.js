const mongoose = require('mongoose');

const vendorOrderSchema = new mongoose.Schema({
    orderId: { type: String, required: true, unique: true },
    vendorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Vendor', required: true },
    barcodeFileId: { type: String, trim: true },
    fileName: { type: String, required: true },
    filePath: { type: String, required: true },
    brand: { type: String, trim: true },
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
            'Production', 
            'Delivered',
            'Completed'
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
    deliveryProofUrl: { type: String },
    deliveryRemarks: { type: String },
    productionDate: { type: Date },
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
    }
}, { timestamps: true });

// Index for performance
vendorOrderSchema.index({ vendorId: 1, status: 1 });

module.exports = mongoose.model('VendorOrder', vendorOrderSchema);
