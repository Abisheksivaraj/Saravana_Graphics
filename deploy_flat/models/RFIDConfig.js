const mongoose = require('mongoose');

const rfidConfigSchema = new mongoose.Schema({
    serialStart: { type: String, default: '274655906933' },
    serialEnd: { type: String, default: '274675906933' },
    currentSerial: { type: String, default: '274655906933' },
    usedSerials: { type: String, default: '0' },
    filter: { type: String, default: '1' },
    partition: { type: String, default: '5' },
    lockBits: { type: String, default: '0' },
    head: { type: String, default: '48' }
}, { timestamps: true });

module.exports = mongoose.model('RFIDConfig', rfidConfigSchema);
