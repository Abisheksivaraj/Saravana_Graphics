
require("node:dns/promises").setServers(["1.1.1.1", "8.8.8.8"]);
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config();

const app = express();

// Middleware
app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:3000'],
  credentials: true,
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Static uploads folder
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/designs', require('./routes/designs'));
app.use('/api/templates', require('./routes/templates'));
app.use('/api/companies', require('./routes/companies'));
app.use('/api/vendors', require('./routes/vendors'));

// Health check
app.get('/api/health', (req, res) => {
  const dbState = mongoose.connection.readyState;
  const dbStatus = dbState === 1 ? 'connected' : dbState === 2 ? 'connecting' : 'disconnected';
  res.json({ status: 'OK', db: dbStatus, message: 'Label Designer API is running', timestamp: new Date().toISOString() });
});

// Start server immediately (don't wait for MongoDB)
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});

// MongoDB connection with retry
const RETRY_INTERVAL = 10000; // 10 seconds
let retryCount = 0;

function connectMongoDB() {
  mongoose.connect(process.env.MONGODB_URI, {
    serverSelectionTimeoutMS: 5000,
    connectTimeoutMS: 10000,
  })
    .then(() => {
      console.log('✅ MongoDB connected successfully');
      retryCount = 0;
    })
    .catch((err) => {
      retryCount++;
      console.warn(`⚠️  MongoDB connection failed (attempt ${retryCount}): ${err.message}`);
      console.warn(`   Retrying in ${RETRY_INTERVAL / 1000}s... Server is still running without DB.`);
      setTimeout(connectMongoDB, RETRY_INTERVAL);
    });
}

connectMongoDB();

module.exports = app;
