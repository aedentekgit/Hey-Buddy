const Webhook = require('../models/Webhook');
const Reminder = require('../models/Reminder');
const Notification = require('../models/Notification');
const crypto = require('crypto');

exports.createWebhook = async (req, res) => {
    try {
        const { name, targetAction } = req.body;
        const secret = crypto.randomBytes(32).toString('hex');

        const webhook = await Webhook.create({
            userId: req.user._id,
            name,
            secret,
            config: { targetAction }
        });

        res.status(201).json({ success: true, data: webhook });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.getWebhooks = async (req, res) => {
    try {
        const webhooks = await Webhook.find({ userId: req.user._id });
        res.status(200).json({ success: true, data: webhooks });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.deleteWebhook = async (req, res) => {
    try {
        await Webhook.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
        res.status(200).json({ success: true, message: 'Webhook deleted' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// The Public Endpoint for Incoming Webhooks
exports.handleIncoming = async (req, res) => {
    try {
        const { secret } = req.params;
        const payload = req.body;

        const webhook = await Webhook.findOne({ secret }).populate('userId');
        if (!webhook) {
            return res.status(404).json({ success: false, message: 'Invalid webhook secret' });
        }

        if (!webhook.active) {
            return res.status(403).json({ success: false, message: 'Webhook is inactive' });
        }

        // Process based on config
        const { targetAction } = webhook.config;

        if (targetAction === 'create_reminder') {
            await Reminder.create({
                userId: webhook.userId._id,
                title: payload.title || 'Webhook Task',
                description: payload.description || 'Triggered from external source',
                date: payload.date || new Date().toISOString().split('T')[0],
                time: payload.time || '09:00',
                source: 'webhook'
            });
        }

        await Notification.create({
            userId: webhook.userId._id,
            title: 'Webhook Triggered',
            message: `External automation "${webhook.name}" successfully triggered a ${targetAction}.`,
            type: 'system'
        });

        webhook.lastUsed = new Date();
        await webhook.save();

        res.status(200).json({ success: true, message: 'Action executed' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
