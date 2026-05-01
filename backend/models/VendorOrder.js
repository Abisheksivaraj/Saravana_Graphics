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
            'Payment Proof Uploaded', 
            'Production', 
            'Despatch', 
            'Delivered'
        ],
        default: 'Excel Uploaded' 
    },
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, required: true, refPath: 'uploaderModel' },
    uploaderModel: { type: String, required: true, enum: ['User', 'Vendor'], default: 'Vendor' },
    remarks: { type: String, default: '' },
    layoutFileUrl: { type: String },
    revisedArtworkUrl: { type: String },
    performaInvoiceUrl: { type: String },
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
