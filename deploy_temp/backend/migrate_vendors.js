require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');
const Vendor = require('./models/Vendor');

const runMigration = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
        
        const vendorUsers = await User.find({ role: 'vendor' });
        console.log(`Found ${vendorUsers.length} vendors in Users collection.`);
        
        for (const u of vendorUsers) {
            const vendorData = u.toObject();
            const existing = await Vendor.findById(vendorData._id);
            
            if (!existing) {
                // Insert directly to bypass Mongoose pre-save hooks (prevents double-hashing passwords)
                await Vendor.collection.insertOne({
                    _id: vendorData._id,
                    name: vendorData.name,
                    email: vendorData.email,
                    username: vendorData.username,
                    password: vendorData.password, 
                    avatar: vendorData.avatar,
                    role: vendorData.role,
                    status: vendorData.status,
                    vendorCode: vendorData.vendorCode,
                    vendorGstin: vendorData.vendorGstin,
                    vendorName: vendorData.vendorName,
                    createdAt: vendorData.createdAt,
                    updatedAt: vendorData.updatedAt
                });
                console.log(`Migrated vendor: ${vendorData.email}`);
                
                // Clean up old record
                await User.findByIdAndDelete(vendorData._id);
            } else {
                console.log(`Vendor already migrated: ${vendorData.email}`);
            }
        }
        
        console.log('Migration complete.');
        process.exit(0);
    } catch (error) {
        console.error('Migration failed:', error);
        process.exit(1);
    }
};

runMigration();
