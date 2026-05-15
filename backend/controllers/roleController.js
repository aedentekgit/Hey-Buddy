const Role = require('../models/Role');
const User = require('../models/User');
const paginate = require('../utils/paginate');

const getRoles = async (req, res) => {
    console.log('GET /api/roles hit');
    try {
        const results = await paginate(Role, {}, req.query);

        // Fetch user counts for each role
        const rolesWithCounts = await Promise.all(results.data.map(async (role) => {
            const userCount = await User.countDocuments({ role: role.name });
            return {
                ...role.toObject(),
                userCount
            };
        }));
        results.data = rolesWithCounts;

        console.log(`Found ${results.data.length} roles`);
        res.status(200).json({ success: true, ...results });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

const createRole = async (req, res) => {
    try {
        const { name, description, permissions, allowedPages, webAccess, mobileAccess } = req.body;

        const existingRole = await Role.findOne({ name });
        if (existingRole) {
            return res.status(400).json({ success: false, message: 'Role already exists' });
        }

        const role = await Role.create({
            name,
            description,
            permissions: permissions || [],
            allowedPages: allowedPages || [],
            webAccess: webAccess !== undefined ? webAccess : true,
            mobileAccess: mobileAccess !== undefined ? mobileAccess : true,
            status: req.body.status || 'active',
            isSystem: false
        });

        res.status(201).json({ success: true, data: role });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

const updateRole = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, description, permissions, allowedPages, webAccess, mobileAccess } = req.body;

        const role = await Role.findById(id);
        if (!role) {
            return res.status(404).json({ success: false, message: 'Role not found' });
        }

        if (role.isSystem) {
            // System roles might only allow description and permission updates
            if (name && name !== role.name) {
                return res.status(403).json({ success: false, message: 'Cannot rename system roles' });
            }
        }

        role.name = name || role.name;
        role.description = description !== undefined ? description : role.description;
        if (permissions) role.permissions = permissions;
        if (allowedPages) role.allowedPages = allowedPages;
        if (webAccess !== undefined) role.webAccess = webAccess;
        if (mobileAccess !== undefined) role.mobileAccess = mobileAccess;
        if (req.body.status) role.status = req.body.status;

        await role.save();

        res.status(200).json({ success: true, data: role });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

const deleteRole = async (req, res) => {
    try {
        const { id } = req.params;
        const role = await Role.findById(id);

        if (!role) {
            return res.status(404).json({ success: false, message: 'Role not found' });
        }

        if (role.isSystem) {
            return res.status(403).json({ success: false, message: 'Cannot delete system roles' });
        }

        const userCount = await User.countDocuments({ role: role.name });
        if (userCount > 0) {
            return res.status(400).json({ success: false, message: 'Cannot delete role with existing users assigned to it. Please reassign the users first.' });
        }

        await role.deleteOne();
        res.status(200).json({ success: true, message: 'Role deleted successfully' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

const assignRole = async (req, res) => {
    try {
        const { userId, roleName } = req.body;

        if (!userId || !roleName) {
            return res.status(400).json({ success: false, message: 'User ID and role name are required' });
        }

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        const role = await Role.findOne({ name: roleName });
        if (!role) {
            return res.status(404).json({ success: false, message: 'Role not found' });
        }

        user.role = role.name;
        await user.save();

        res.status(200).json({ success: true, message: 'Role assigned successfully', data: user });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

module.exports = { getRoles, createRole, updateRole, deleteRole, assignRole };
