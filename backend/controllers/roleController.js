const Role = require('../models/Role');
const paginate = require('../utils/paginate');

const getRoles = async (req, res) => {
    console.log('GET /api/roles hit');
    try {
        const results = await paginate(Role, {}, req.query);
        console.log(`Found ${results.data.length} roles`);
        res.status(200).json({ success: true, ...results });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

const createRole = async (req, res) => {
    try {
        const { name, description, permissions, allowedPages } = req.body;

        const existingRole = await Role.findOne({ name });
        if (existingRole) {
            return res.status(400).json({ success: false, message: 'Role already exists' });
        }

        const role = await Role.create({
            name,
            description,
            permissions: permissions || [],
            allowedPages: allowedPages || [],
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
        const { name, description, permissions, allowedPages } = req.body;

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

        await role.deleteOne();
        res.status(200).json({ success: true, message: 'Role deleted successfully' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

module.exports = { getRoles, createRole, updateRole, deleteRole };
