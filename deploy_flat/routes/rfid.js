const express = require('express');
const router = express.Router();
const RFIDConfig = require('../models/RFIDConfig');
const auth = require('../middleware/auth');

// GET configuration
router.get('/config', auth, async (req, res) => {
    try {
        let config = await RFIDConfig.findOne();
        if (!config) {
            config = new RFIDConfig();
            await config.save();
        }
        res.json(config);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// UPDATE configuration
router.post('/config', auth, async (req, res) => {
    try {
        let config = await RFIDConfig.findOne();
        if (!config) {
            config = new RFIDConfig(req.body);
        } else {
            Object.assign(config, req.body);
        }
        await config.save();
        res.json(config);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

module.exports = router;
