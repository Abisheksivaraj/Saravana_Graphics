const mongoose = require('mongoose');
const Template = require('./models/Template');
const { v4: uuid } = require('uuid');
require('dotenv').config();

const MONGO_URI = process.env.MONGODB_URI || 'mongodb+srv://sivarajt956_db_user:LFH62kjnyyso7huK@saravanagraphics.na5lf5b.mongodb.net/';

async function seed() {
    try {
        await mongoose.connect(MONGO_URI);
        console.log('Connected to MongoDB');

        // Delete existing Price Tag templates to update
        await Template.deleteMany({ title: 'Professional Price Tag' });

        const template = new Template({
            title: 'Professional Price Tag',
            description: 'Industry-standard clothing tag for apparel with MRP, size, barcode, and QR code.',
            category: 'clothing-tag',
            canvasWidth: 350,
            canvasHeight: 700,
            backgroundColor: '#ffffff',
            isPublic: true,
            tags: ['retail', 'apparel', 'price', 'barcode', 'qr'],
            elements: [
                // Main border
                {
                    id: uuid(), type: 'rect', x: 10, y: 10, width: 330, height: 680,
                    fill: 'transparent', stroke: '#e91e63', strokeWidth: 1, cornerRadius: 25, zIndex: 0
                },
                // Tag hole circle at top - REDUCED SIZE
                {
                    id: uuid(), type: 'circle', x: 175, y: 35, radius: 8,
                    fill: 'transparent', stroke: '#e91e63', strokeWidth: 1, zIndex: 1
                },
                // Green bar
                {
                    id: uuid(), type: 'rect', x: 11, y: 65, width: 328, height: 22,
                    fill: '#00a65a', strokeWidth: 0, zIndex: 2
                },
                // MRP Section
                {
                    id: uuid(), type: 'text', x: 0, y: 105, text: 'MRP (Incl.of all taxes)',
                    fontSize: 13, fontFamily: 'Arial', fontWeight: 'bold', textAlign: 'center',
                    fill: '#333', width: 350, zIndex: 3
                },
                {
                    id: uuid(), type: 'text', x: 0, y: 125, text: '₹599.00',
                    fontSize: 40, fontFamily: 'Arial', fontWeight: '900', textAlign: 'center',
                    fill: '#000', width: 350, zIndex: 4
                },
                // Size section bar context
                {
                    id: uuid(), type: 'line', x: 11, y: 180, points: [0, 0, 328, 0],
                    stroke: '#000', strokeWidth: 0.8, zIndex: 5
                },
                {
                    id: uuid(), type: 'text', x: 40, y: 190, text: 'Size : 92 cm',
                    fontSize: 20, fontFamily: 'Arial', fontWeight: 'bold', fill: '#000', zIndex: 6
                },
                {
                    id: uuid(), type: 'text', x: 260, y: 190, text: 'M',
                    fontSize: 20, fontFamily: 'Arial', fontWeight: 'bold', fill: '#000', zIndex: 7
                },
                {
                    id: uuid(), type: 'line', x: 11, y: 225, points: [0, 0, 328, 0],
                    stroke: '#000', strokeWidth: 0.8, zIndex: 8
                },
                // Product properties
                {
                    id: uuid(), type: 'text', x: 25, y: 245, text: 'MUSTARD\nDNMX TSHIRT\nTS21BWWWTS3499',
                    fontSize: 11, fontFamily: 'Arial', fontWeight: 'bold', fill: '#000', zIndex: 9
                },
                {
                    id: uuid(), type: 'text', x: 190, y: 245, text: 'ART : 441114191015\nMFD ON : 11/2025\nNET QTY : 1 NUMBER',
                    fontSize: 10, fontFamily: 'Arial', fontWeight: 'bold', fill: '#000', zIndex: 10
                },
                // Barcode
                {
                    id: uuid(), type: 'barcode', x: 50, y: 310, barcodeValue: '8905263411803',
                    barcodeFormat: 'EAN13', width: 250, height: 90, fill: '#000', zIndex: 11
                },
                {
                    id: uuid(), type: 'text', x: 0, y: 410, text: '8 905263 411803',
                    fontSize: 16, fontFamily: 'Arial', fontWeight: 'normal', textAlign: 'center',
                    fill: '#000', width: 350, zIndex: 12
                },
                {
                    id: uuid(), type: 'line', x: 11, y: 440, points: [0, 0, 328, 0],
                    stroke: '#000', strokeWidth: 0.8, zIndex: 13
                },
                // Manufacturer Details
                {
                    id: uuid(), type: 'text', x: 0, y: 450,
                    text: 'RELIANCE RETAIL LIMITED\nSHED NO.77/80,INDIAN CORPORATION\nGODOWN, MANKOLI NAKA,\nVILLAGE:DAPODE,TALUKA:BHIWANDI,\nDIST:THANE,MAHARASHTRA,PIN: 421302',
                    fontSize: 10, fontFamily: 'Arial', fontWeight: 'bold', textAlign: 'center',
                    fill: '#000', width: 350, zIndex: 14
                },
                {
                    id: uuid(), type: 'line', x: 11, y: 550, points: [0, 0, 328, 0],
                    stroke: '#000', strokeWidth: 0.8, zIndex: 15
                },
                // Complaints section
                {
                    id: uuid(), type: 'text', x: 0, y: 560,
                    text: 'FOR COMPLAINTS/FEEDBACK, PLS WRITE TO OUR\nCUSTOMER CARE EXECUTIVE AT THE ABOVE ADDRESS OR\ncustomerservice@ril.com or\nCALL 1800 891 0001 / 1800 102 7382',
                    fontSize: 9, fontFamily: 'Arial', fontWeight: 'bold', textAlign: 'center',
                    fill: '#000', width: 350, zIndex: 16
                },
                // RFID Icon placeholder
                {
                    id: uuid(), type: 'rect', x: 40, y: 625, width: 40, height: 30, stroke: '#000', strokeWidth: 1, fill: 'transparent', zIndex: 17
                },
                {
                    id: uuid(), type: 'text', x: 45, y: 635, text: 'RFID', fontSize: 10, fontFamily: 'Arial', fontWeight: 'bold', zIndex: 18
                },
                // QR Code
                {
                    id: uuid(), type: 'qrcode', x: 270, y: 620, qrValue: 'https://www.ril.com',
                    width: 50, height: 50, zIndex: 19
                }
            ]
        });

        await template.save();
        console.log('Seed successful: Professional Price Tag added.');
        process.exit();
    } catch (err) {
        console.error('Seed fatal error:', err);
        process.exit(1);
    }
}

seed();
