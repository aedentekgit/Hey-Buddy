const axios = require('axios');
const jwt = require('jsonwebtoken');
require('dotenv').config({ path: './.env' });
const mongoose = require('mongoose');
const User = require('../models/User');
const Reminder = require('../models/Reminder');

const DB_URI = process.env.MONGODB_URI;
const API_URL = 'http://localhost:5001/api';

async function runHealthCheck() {
    console.log("=== BUDDY SYSTEM HEALTH CHECK ===");
    console.log("Checking core services...");

    let passed = 0;
    let failed = 0;

    try {
        await mongoose.connect(DB_URI);
        console.log("✅ Database Connection: Passed");
        passed++;
    } catch (err) {
        console.error("❌ Database Connection: Failed", err.message);
        failed++;
        process.exit(1);
    }

    const adminEmail = 'admin@buddy.com';
    let user = await User.findOne({ email: adminEmail });
    if (!user) {
        console.error("❌ Admin User Lookup: Failed - User not found");
        failed++;
        process.exit(1);
    }
    console.log("✅ Admin User Lookup: Passed");
    passed++;

    const token = jwt.sign({ id: user._id.toString() }, process.env.JWT_SECRET || 'supersecretkey123', { expiresIn: '1y' });

    // Test 1: Manual Reminder via API (checks Google Sync if linked)
    let createdReminderId = null;
    try {
        const payload = {
            reminderData: {
                title: "Health Check Reminder",
                date: "2026-03-05",
                time: "02:00 PM",
                location: "Server",
                intent: "manual_creation",
            },
            saveTo: 'both'
        };
        const res = await axios.post(`${API_URL}/voice/save`, payload, {
            headers: { Authorization: `Bearer ${token}` }
        });

        createdReminderId = res.data.data._id;
        if (user.googleRefreshToken) {
            if (res.data.data.googleEventId) {
                console.log("✅ Manual Reminder Creation (with Google Sync): Passed");
                passed++;
            } else {
                console.error("❌ Manual Reminder Creation (with Google Sync): Failed - No Event ID generated");
                failed++;
            }
        } else {
            console.log("✅ Manual Reminder Creation (Offline/Local Buddy Mode): Passed");
            passed++;
        }
    } catch (err) {
        console.error("❌ Manual Reminder Creation: Failed", err.response?.data || err.message);
        failed++;
    }

    // Test 2: List Reminders Endpoint
    try {
        const res = await axios.get(`${API_URL}/reminders`, {
            headers: { Authorization: `Bearer ${token}` }
        });

        if (res.data.success && Array.isArray(res.data.data) && res.data.data.length > 0) {
            console.log("✅ Retrieve Reminders List: Passed");
            passed++;
        } else {
            console.error("❌ Retrieve Reminders List: Failed or Empty");
            failed++;
        }
    } catch (err) {
        console.error("❌ Retrieve Reminders List: Failed", err.response?.data || err.message);
        failed++;
    }

    // Cleanup
    if (createdReminderId) {
        try {
            await axios.delete(`${API_URL}/voice/${createdReminderId}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            console.log("✅ Test Data Cleanup: Passed");
            passed++;
        } catch (err) {
            console.error("❌ Test Data Cleanup: Failed", err.response?.data || err.message);
            failed++;
        }
    }

    console.log("\n=== HEALTH CHECK REPORT ===");
    console.log(`Total Tests Run: ${passed + failed}`);
    console.log(`Passed: ${passed}`);
    console.log(`Failed: ${failed}`);

    process.exit(failed > 0 ? 1 : 0);
}

runHealthCheck();
