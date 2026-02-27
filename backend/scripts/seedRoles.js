const mongoose = require('mongoose');
const Role = require('./models/Role');
const dotenv = require('dotenv');

dotenv.config();

const seedRoles = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/staging_Heybuddy');

        const rolesToSeed = [
            {
                name: 'admin',
                description: 'Full system access',
                permissions: ['dashboard', 'analytics', 'users', 'roles', 'settings'],
                allowedPages: ['dashboard', 'analytics', 'users', 'management', 'roles', 'settings', 'buddy', 'memories', 'calendar', 'reminders'],
                isSystem: true
            },
            {
                name: 'user',
                description: 'Standard user access',
                permissions: ['dashboard', 'analytics'],
                allowedPages: ['dashboard', 'analytics', 'buddy', 'memories', 'calendar', 'reminders'],
                isSystem: true
            }
        ];

        for (const roleData of rolesToSeed) {
            const result = await Role.updateOne(
                { name: roleData.name },
                { $set: roleData },
                { upsert: true }
            );

            if (result.upsertedCount > 0) {
                console.log(`Role created: ${roleData.name}`);
            } else {
                console.log(`Role updated: ${roleData.name}`);
            }
        }

        console.log('Roles seeded successfully');
        process.exit();
    } catch (error) {
        console.error('Error seeding roles:', error.message);
        process.exit(1);
    }
};

seedRoles();
