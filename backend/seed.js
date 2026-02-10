const mongoose = require('mongoose');
const User = require('./models/User');
const Role = require('./models/Role');
const dotenv = require('dotenv');

dotenv.config();

const seedData = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/admin_db');
        console.log('Connected to MongoDB for seeding...');

        // 1. Seed Roles
        const defaultRoles = [
            {
                name: 'admin',
                description: 'System Administrator with full access',
                permissions: ['dashboard', 'analytics', 'users', 'roles', 'settings', 'buddy', 'memories', 'reminders'],
                allowedPages: ['dashboard', 'users', 'roles', 'settings', 'buddy', 'memories', 'reminders'],
                isSystem: true
            },
            {
                name: 'user',
                description: 'Standard User',
                permissions: ['dashboard', 'buddy', 'memories', 'reminders', 'settings'],
                allowedPages: ['dashboard', 'buddy', 'memories', 'reminders', 'settings'],
                isSystem: true
            }
        ];

        for (const roleData of defaultRoles) {
            await Role.findOneAndUpdate(
                { name: roleData.name },
                roleData,
                { upsert: true, new: true }
            );
            console.log(`Role '${roleData.name}' synced.`);
        }

        // 2. Seed Admin User
        const adminEmail = 'admin@example.com';
        const adminExists = await User.findOne({ email: adminEmail });

        if (!adminExists) {
            const admin = new User({
                name: 'Administrator',
                email: adminEmail,
                password: 'adminpassword123',
                role: 'admin'
            });

            await admin.save();
            console.log('Admin user created successfully');
            console.log('Email:', adminEmail);
            console.log('Password: adminpassword123');
        } else {
            // Update existing admin to ensure it has the admin role and name
            adminExists.role = 'admin';
            adminExists.name = adminExists.name || 'Administrator';
            await adminExists.save();
            console.log('Admin user already exists, updated role to admin');
        }

        console.log('Seeding completed successfully!');
        process.exit();
    } catch (error) {
        console.error('Error seeding data:', error.message);
        process.exit(1);
    }
};

seedData();
