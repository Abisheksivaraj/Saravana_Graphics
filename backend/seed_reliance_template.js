const mongoose = require('mongoose');
const Template = require('./models/Template');
const { v4: uuid } = require('uuid');
require('dotenv').config();

const MONGO_URI = process.env.MONGODB_URI || 'mongodb+srv://sivarajt956_db_user:LFH62kjnyyso7huK@saravanagraphics.na5lf5b.mongodb.net/';

async function seed() {
    try {
        await mongoose.connect(MONGO_URI);
        console.log('Connected to MongoDB');

        // Delete existing if it exists
        await Template.deleteMany({ title: 'Reliance Retail Label' });

        const template = new Template({
            title: 'Reliance Retail Label',
            description: 'Exact replica of Reliance Retail product tag with MRP, size, barcode, and QR code.',
            category: 'clothing-tag',
            canvasWidth: 350,
            canvasHeight: 700,
            backgroundColor: '#ffffff',
            isPublic: true,
            tags: ['retail', 'reliance', 'clothing', 'barcode', 'qr'],
            elements: [
                // Pink rounded border
                {
                    id: uuid(), type: 'rect', x: 8, y: 8, width: 334, height: 684,
                    fill: 'transparent', stroke: '#ff3385', strokeWidth: 1.5, cornerRadius: 40, zIndex: 0
                },
                // Tag hole circle
                {
                    id: uuid(), type: 'circle', x: 175, y: 38, radius: 10,
                    fill: 'transparent', stroke: '#ff3385', strokeWidth: 1, zIndex: 1
                },
                // Green bar
                {
                    id: uuid(), type: 'rect', x: 9, y: 68, width: 332, height: 26,
                    fill: '#00a65a', strokeWidth: 0, zIndex: 2
                },
                // MRP Section
                {
                    id: uuid(), type: 'text', x: 0, y: 105, text: 'MRP (Incl.of all taxes)',
                    fontSize: 14, fontFamily: 'Arial', fontWeight: 'bold', textAlign: 'center',
                    fill: '#333', width: 350, zIndex: 3
                },
                {
                    id: uuid(), type: 'text', x: 0, y: 125, text: '₹599.00',
                    fontSize: 44, fontFamily: 'Arial', fontWeight: '900', textAlign: 'center',
                    fill: '#000', width: 350, zIndex: 4
                },
                // Size section lines and text
                {
                    id: uuid(), type: 'line', x: 9, y: 180, points: [0, 0, 332, 0],
                    stroke: '#000', strokeWidth: 1.5, zIndex: 5
                },
                {
                    id: uuid(), type: 'text', x: 30, y: 192, text: 'Size :',
                    fontSize: 24, fontFamily: 'Arial', fontWeight: 'bold', fill: '#000', zIndex: 6
                },
                {
                    id: uuid(), type: 'text', x: 100, y: 192, text: '92',
                    fontSize: 24, fontFamily: 'Arial', fontWeight: 'bold', fill: '#000', zIndex: 7
                },
                {
                    id: uuid(), type: 'text', x: 140, y: 192, text: 'cm',
                    fontSize: 24, fontFamily: 'Arial', fontWeight: 'bold', fill: '#000', zIndex: 8
                },
                {
                    id: uuid(), type: 'text', x: 260, y: 192, text: 'M',
                    fontSize: 24, fontFamily: 'Arial', fontWeight: 'bold', fill: '#000', zIndex: 9
                },
                {
                    id: uuid(), type: 'line', x: 9, y: 232, points: [0, 0, 332, 0],
                    stroke: '#000', strokeWidth: 1.5, zIndex: 10
                },
                // Product details (Left - split)
                {
                    id: uuid(), type: 'text', x: 25, y: 250, text: 'COLOUR',
                    fontSize: 12, fontFamily: 'Arial', fontWeight: 'bold', fill: '#000', zIndex: 11
                },
                {
                    id: uuid(), type: 'text', x: 25, y: 272, text: 'Desc',
                    fontSize: 12, fontFamily: 'Arial', fontWeight: 'bold', fill: '#000', zIndex: 12
                },
                {
                    id: uuid(), type: 'text', x: 25, y: 294, text: 'Style No',
                    fontSize: 12, fontFamily: 'Arial', fontWeight: 'bold', fill: '#000', zIndex: 13
                },
                // Product details (Right - split)
                {
                    id: uuid(), type: 'text', x: 185, y: 250, text: 'Article',
                    fontSize: 11, fontFamily: 'Arial', fontWeight: 'bold', fill: '#000', zIndex: 14
                },
                {
                    id: uuid(), type: 'text', x: 185, y: 272, text: 'MFD ON',
                    fontSize: 11, fontFamily: 'Arial', fontWeight: 'bold', fill: '#000', zIndex: 15
                },
                {
                    id: uuid(), type: 'text', x: 185, y: 294, text: 'NET QTY',
                    fontSize: 11, fontFamily: 'Arial', fontWeight: 'bold', fill: '#000', zIndex: 16
                },
                // Barcode Section
                {
                    id: uuid(), type: 'barcode', x: 45, y: 315, barcodeValue: '8905263411803',
                    barcodeFormat: 'EAN13', width: 260, height: 95, fill: '#000', zIndex: 17
                },
                {
                    id: uuid(), type: 'text', x: 0, y: 415, text: '8 905263 411803',
                    fontSize: 18, fontFamily: 'Arial', fontWeight: 'normal', textAlign: 'center',
                    fill: '#000', width: 350, zIndex: 18
                },
                {
                    id: uuid(), type: 'line', x: 9, y: 445, points: [0, 0, 332, 0],
                    stroke: '#000', strokeWidth: 1.5, zIndex: 19
                },
                // Manufacturer Details
                {
                    id: uuid(), type: 'text', x: 0, y: 455,
                    text: 'RELIANCE RETAIL LIMITED\nSHED NO.77/80,INDIAN CORPORATION\nGODOWN, MANKOLI NAKA,\nVILLAGE:DAPODE,TALUKA:BHIWANDI,\nDIST:THANE,MAHARASHTRA,PIN: 421302',
                    fontSize: 11, fontFamily: 'Arial', fontWeight: 'bold', textAlign: 'center',
                    fill: '#000', width: 350, zIndex: 20
                },
                {
                    id: uuid(), type: 'line', x: 9, y: 560, points: [0, 0, 332, 0],
                    stroke: '#000', strokeWidth: 1.5, zIndex: 21
                },
                // Customer Care Section
                {
                    id: uuid(), type: 'text', x: 0, y: 570,
                    text: 'FOR COMPLAINTS/FEEDBACK, PLS WRITE TO OUR\nCUSTOMER CARE EXECUTIVE AT THE ABOVE ADDRESS OR\ncustomerservice@ril.com or\nCALL 1800 891 0001 / 1800 102 7382',
                    fontSize: 10, fontFamily: 'Arial', fontWeight: 'bold', textAlign: 'center',
                    fill: '#000', width: 350, zIndex: 22
                },
                // RFID Icon (more detailed)
                {
                    id: uuid(), type: 'rect', x: 40, y: 640, width: 45, height: 35, stroke: '#000', strokeWidth: 1.5, cornerRadius: 4, zIndex: 23
                },
                {
                    id: uuid(), type: 'text', x: 40, y: 651, text: 'RFID', fontSize: 11, fontFamily: 'Arial', fontWeight: 'bold', textAlign: 'center', width: 45, zIndex: 24
                },
                {
                    id: uuid(), type: 'text', x: 28, y: 650, text: 'SARA', fontSize: 8, fontFamily: 'Arial', fontWeight: 'bold', rotation: -90, zIndex: 25
                },
                // QR Code
                {
                    id: uuid(), type: 'qrcode', x: 265, y: 630, qrValue: 'https://www.reliance.com',
                    width: 55, height: 55, zIndex: 26
                }
            ]
        });

        await template.save();
        console.log('Seed successful: Reliance Retail Label added to library.');
        process.exit();
    } catch (err) {
        console.error('Seed error:', err);
        process.exit(1);
    }
}

seed();
