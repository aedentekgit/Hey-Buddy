const mongoose = require('mongoose');
const User = require('./models/User');
const Role = require('./models/Role');
const dotenv = require('dotenv');

dotenv.config();

const seedData = async () => {
    try {
        if (!process.env.MONGODB_URI) {
            throw new Error('MONGODB_URI is required for seeding.');
        }
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB for seeding...');

        // 1. Seed Roles
        const defaultRoles = [
            {
                name: 'admin',
                description: 'System Administrator with full access',
                permissions: ['dashboard', 'analytics', 'users', 'roles', 'settings', 'buddy', 'memories', 'reminders', 'management'],
                allowedPages: ['dashboard', 'users', 'roles', 'settings', 'buddy', 'memories', 'reminders', 'management'],
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
        const adminEmail = 'admin@buddy.com';
        const adminExists = await User.findOne({ email: adminEmail });

        if (!adminExists) {
            const tempPassword = process.env.SEED_ADMIN_PASSWORD || require('crypto').randomBytes(12).toString('base64url');
            const admin = new User({
                _id: new mongoose.Types.ObjectId().toString(),
                name: 'Administrator',
                email: adminEmail,
                password: tempPassword,
                role: 'admin'
            });

            await admin.save();
            console.log('Admin user created successfully');
            console.log('Email:', adminEmail);
            console.log('Temporary password:', tempPassword);
        } else {
            // Update existing admin to ensure it has the admin role and name
            adminExists.role = 'admin';
            adminExists.name = adminExists.name || 'Administrator';
            await adminExists.save();
            console.log('Admin user already exists, updated role to admin');
        }

        // 3. Seed Settings
        const Settings = require('./models/Settings');
        const settingsExists = await Settings.findOne();
        if (!settingsExists) {
            const defaultSettings = new Settings({
                general: {
                    companyName: 'Buddy AI',
                    address: 'Digital India',
                    phone: '+91 99999 99999',
                    emails: ['admin@buddy.com'],
                    timeZone: 'Asia/Kolkata'
                },
                appearance: {
                    themeMode: 'night',
                    accentColor: '#0075ff'
                },
                isConfigured: true
            });
            await defaultSettings.save();
            console.log('Default settings seeded');
        }

        console.log('Seeding completed successfully!');
        process.exit();
    } catch (error) {
        console.error('Error seeding data:', error.message);
        process.exit(1);
    }
};

seedData();
