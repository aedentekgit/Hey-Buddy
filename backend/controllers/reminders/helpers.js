// Shared helpers for reminderController — used across all CRUD, sharing, calendar, and travel modules
const axios = require('axios');

// ─── AI SYNC HELPER ───────────────────────────────────────────────────────────
/**
 * Notify the Python AI service to reload its vector store after knowledge changes.
 */
async function triggerVectorReload() {
    try {
        const aiServiceUrl = process.env.AI_SERVICE_URL || 'http://localhost:8000';
        await axios.post(`${aiServiceUrl}/system/reload`, {}, {
            headers: { 'X-API-Key': process.env.INTERNAL_SECRET || process.env.BUDDY_API_KEY || '' }
        });
        console.log('[AI-SYNC] Vector store reload triggered successfully');
    } catch (error) {
        console.error('[AI-SYNC] Failed to trigger vector store reload:', error.message);
    }
}

// ─── Adjusted Notification Calculator ────────────────────────────────────────
/**
 * Given a pickup time string ("HH:MM" or "HH:MM AM/PM"), subtract total prepare
 * minutes and return a formatted adjusted time string.
 *
 * @param {string} pickupTime  - "23:00" or "11:00 PM" or "11:00 pm"
 * @param {number} travelMin   - estimated travel time in minutes
 * @param {number} bufferMin   - safety buffer in minutes
 * @param {string} timeFormat  - "12" or "24", defaults to "12"
 * @returns {{ adjustedTime: string, pickupFormatted: string, totalPrepare: number }}
 */
function calcAdjustedNotification(pickupTime, travelMin, bufferMin, timeFormat = '12') {
    if (!pickupTime) return null;
    const total = (Number(travelMin) || 0) + (Number(bufferMin) || 0);

    // Parse pickup time (supports "HH:MM", "HH:MM AM", "HH:MM PM")
    let [timePart, meridiem] = pickupTime.trim().split(' ');
    let [hStr, mStr] = timePart.split(':');
    let h = parseInt(hStr, 10);
    let m = parseInt(mStr, 10);
    if (isNaN(h) || isNaN(m)) return null;

    if (meridiem) {
        if (meridiem.toLowerCase() === 'pm' && h < 12) h += 12;
        if (meridiem.toLowerCase() === 'am' && h === 12) h = 0;
    }

    // Build a base date (today) and subtract
    const base = new Date();
    base.setHours(h, m, 0, 0);
    const adjusted = new Date(base.getTime() - total * 60000);

    const fmt = (d, fmt12) => {
        const ah = d.getHours();
        const am = d.getMinutes();
        if (fmt12 === '24') {
            return `${String(ah).padStart(2, '0')}:${String(am).padStart(2, '0')}`;
        }
        const period = ah >= 12 ? 'PM' : 'AM';
        const displayH = ah % 12 || 12;
        return `${String(displayH).padStart(2, '0')}:${String(am).padStart(2, '0')} ${period}`;
    };

    return {
        adjustedTime: fmt(adjusted, timeFormat),
        pickupFormatted: fmt(base, timeFormat),
        totalPrepare: total
    };
}

// ─── Overdue Status Helper ─────────────────────────────────────────────────────
function appendOverdueStatus(data) {
    const isArray = Array.isArray(data);
    const records = isArray ? data : [data];
    const now = new Date();

    const augmented = records.map(r => {
        let isOverdue = false;
        if (r.date && r.time) {
            let reminderHour = 0;
            let reminderMin = 0;
            const timeStr = r.time || '00:00';
            const ampmMatch = timeStr.match(/(\d+):(\d+)\s*(am|pm)/i);

            if (ampmMatch) {
                reminderHour = parseInt(ampmMatch[1], 10);
                reminderMin = parseInt(ampmMatch[2], 10);
                const period = ampmMatch[3].toLowerCase();
                if (period === 'pm' && reminderHour < 12) reminderHour += 12;
                if (period === 'am' && reminderHour === 12) reminderHour = 0;
            } else {
                const parts = timeStr.split(':');
                reminderHour = parseInt(parts[0], 10) || 0;
                reminderMin = parseInt(parts[1], 10) || 0;
            }

            const reminderDateTime = new Date(r.date);
            reminderDateTime.setHours(reminderHour, reminderMin, 0, 0);

            if (reminderDateTime < now) {
                isOverdue = true;
            }
        }

        const obj = typeof r.toObject === 'function' ? r.toObject() : r;
        return {
            ...obj,
            isOverdue
        };
    });

    return isArray ? augmented : augmented[0];
}

module.exports = {
    triggerVectorReload,
    calcAdjustedNotification,
    appendOverdueStatus
};