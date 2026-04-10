const mongoose = require('mongoose');
const dotenv = require('dotenv');
const User = require('./models/User');

dotenv.config();

const seedVendors = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB');

        // Create Admin
        const adminEmail = 'admin@saravana.com';
        const existingAdmin = await User.findOne({ email: adminEmail });
        if (!existingAdmin) {
            await User.create({
                name: 'System Admin',
                email: adminEmail,
                username: 'admin',
                password: 'password123',
                role: 'admin'
            });
            console.log('Admin user created');
        }

        // Create 40 Vendors
        console.log('Creating 40 vendors...');
        const vendorPromises = [];
        for (let i = 1; i <= 40; i++) {
            const vendorCode = `VND${String(i).padStart(3, '0')}`;
            const username = `vendor${i}`;
            const email = `${username}@example.com`;

            const existingVendor = await User.findOne({ username });
            if (!existingVendor) {
                vendorPromises.push(User.create({
                    name: `Vendor ${i}`,
                    email: email,
                    username: username,
                    password: 'password123',
                    role: 'vendor',
                    vendorCode: vendorCode
                }));
            }
        }

        await Promise.all(vendorPromises);
        console.log(`Successfully created ${vendorPromises.length} new vendors`);
        
        process.exit(0);
    } catch (err) {
        console.error('Error seeding vendors:', err);
        process.exit(1);
    }
};

seedVendors();
