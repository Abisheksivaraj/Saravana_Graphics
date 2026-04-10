const mongoose = require('mongoose');

const vendorOrderSchema = new mongoose.Schema({
    orderId: { type: String, required: true, unique: true },
    vendorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    barcodeFileId: { type: String, trim: true },
    fileName: { type: String, required: true },
    filePath: { type: String, required: true },
    brand: { type: String, trim: true },
    status: { 
        type: String, 
        enum: ['Queued', 'Verification', 'Excel Uploaded', 'Layout Uploaded', 'Artwork Rejected', 'Artwork Approved', 'Production', 'Despatch', 'Payment Follow-up', 'Reject', 'Artwork Approval', 'APPROVED'],
        default: 'Excel Uploaded' 
    },
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    remarks: { type: String, default: '' },
    layoutFileUrl: { type: String },
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
vendorOrderSchema.index({ orderId: 1 });

module.exports = mongoose.model('VendorOrder', vendorOrderSchema);
