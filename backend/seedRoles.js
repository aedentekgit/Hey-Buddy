const mongoose = require('mongoose');
const Role = require('./models/Role');
const dotenv = require('dotenv');

dotenv.config();

const seedRoles = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/admin_db');

        const rolesToSeed = [
            {
                name: 'admin',
                description: 'Full system access',
                permissions: ['dashboard', 'analytics', 'users', 'roles', 'settings'],
                isSystem: true
            },
            {
                name: 'user',
                description: 'Standard user access',
                permissions: ['dashboard'],
                isSystem: true
            }
        ];

        for (const roleData of rolesToSeed) {
            const exists = await Role.findOne({ name: roleData.name });
            if (!exists) {
                await Role.create(roleData);
                console.log(`Role created: ${roleData.name}`);
            } else {
                console.log(`Role already exists: ${roleData.name}`);
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
