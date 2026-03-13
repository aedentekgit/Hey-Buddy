const { google } = require('googleapis');
const User = require('../models/User');
const Settings = require('../models/Settings');

async function getGoogleCredentials() {
    const settings = await Settings.findOne().select('+googleCalendar.clientSecret');
    const googleConfig = settings?.googleCalendar;

    return {
        clientId: googleConfig?.clientId,
        clientSecret: googleConfig?.clientSecret,
        redirectUri: googleConfig?.redirectUri || process.env.GOOGLE_REDIRECT_URI
    };
}

async function getOauth2Client(userId) {
    const user = await User.findById(userId);
    if (!user || !user.googleRefreshToken) {
        throw new Error("Google Calendar not linked.");
    }

    const { clientId, clientSecret, redirectUri } = await getGoogleCredentials();
    if (!clientId || !clientSecret) {
        throw new Error("Google Calendar credentials not configured.");
    }

    const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
    oauth2Client.setCredentials({ refresh_token: user.googleRefreshToken });
    return oauth2Client;
}

function parseTime(timeStr) {
    let rHour, rMin;
    const ampmMatch = timeStr.match(/(\d+):(\d+)\s*(am|pm)/i);
    if (ampmMatch) {
        rHour = parseInt(ampmMatch[1]);
        rMin = parseInt(ampmMatch[2]);
        const period = ampmMatch[3].toLowerCase();
        if (period === 'pm' && rHour < 12) rHour += 12;
        if (period === 'am' && rHour === 12) rHour = 0;
    } else {
        const parts = timeStr.split(':');
        rHour = parseInt(parts[0]);
        rMin = parseInt(parts[1]) || 0;
    }
    return { hour: rHour, minute: rMin };
}

exports.createGoogleCalendarEvent = async (userId, reminderData) => {
    try {
        const user = await User.findById(userId);
        const userTimeZone = user?.timezone || 'Asia/Kolkata';
        const auth = await getOauth2Client(userId);
        const calendar = google.calendar({ version: 'v3', auth });

        const [year, month, day] = reminderData.date.split('-').map(Number);
        const { hour, minute } = parseTime(reminderData.time);

        const startDateTime = new Date(year, month - 1, day, hour, minute);
        if (isNaN(startDateTime.getTime())) {
            throw new Error(`Invalid date/time combination: ${reminderData.date} ${reminderData.time}`);
        }
        const endDateTime = new Date(startDateTime.getTime() + 30 * 60000);

        const event = {
            summary: reminderData.title,
            location: reminderData.location,
            description: reminderData.description || `Created via Buddy AI.`,
            start: { dateTime: startDateTime.toISOString(), timeZone: userTimeZone },
            end: { dateTime: endDateTime.toISOString(), timeZone: userTimeZone },
        };

        const response = await calendar.events.insert({ calendarId: 'primary', resource: event });
        return response.data.id;
    } catch (error) {
        console.error("createGoogleCalendarEvent Error:", error.message);
        throw error;
    }
};

exports.updateGoogleCalendarEvent = async (userId, eventId, reminderData) => {
    try {
        const user = await User.findById(userId);
        const userTimeZone = user?.timezone || 'Asia/Kolkata';
        const auth = await getOauth2Client(userId);
        const calendar = google.calendar({ version: 'v3', auth });

        const [year, month, day] = reminderData.date.split('-').map(Number);
        const { hour, minute } = parseTime(reminderData.time);

        const startDateTime = new Date(year, month - 1, day, hour, minute);
        if (isNaN(startDateTime.getTime())) {
            throw new Error(`Invalid date/time combination: ${reminderData.date} ${reminderData.time}`);
        }
        const endDateTime = new Date(startDateTime.getTime() + 30 * 60000);

        const event = {
            summary: reminderData.title,
            location: reminderData.location,
            description: reminderData.description || `Updated via Buddy AI.`,
            start: { dateTime: startDateTime.toISOString(), timeZone: userTimeZone },
            end: { dateTime: endDateTime.toISOString(), timeZone: userTimeZone },
        };

        await calendar.events.patch({
            calendarId: 'primary',
            eventId: eventId,
            resource: event
        });
        return true;
    } catch (error) {
        console.error("updateGoogleCalendarEvent Error:", error.message);
        throw error;
    }
};

exports.deleteGoogleCalendarEvent = async (userId, eventId) => {
    try {
        const auth = await getOauth2Client(userId);
        const calendar = google.calendar({ version: 'v3', auth });

        await calendar.events.delete({
            calendarId: 'primary',
            eventId: eventId
        });
        return true;
    } catch (error) {
        // If event already deleted, consider it success
        if (error.code === 404 || error.code === 410) return true;
        console.error("deleteGoogleCalendarEvent Error:", error.message);
        throw error;
    }
};

/**
 * Syncs all unsynced pending reminders for a user to Google Calendar.
 */
exports.syncAllReminders = async (userId) => {
    const Reminder = require('../models/Reminder');
    try {
        const user = await User.findById(userId);
        if (!user || !user.googleRefreshToken) return;

        // Fetch pending time-based reminders that don't have a googleEventId
        const reminders = await Reminder.find({
            userId,
            status: 'pending',
            reminderType: 'time',
            googleEventId: null
        });

        console.log(`[GoogleSync] Found ${reminders.length} unsynced reminders for user ${userId}`);

        for (const reminder of reminders) {
            try {
                // Ensure it has date and time before syncing
                if (reminder.date && reminder.time) {
                    const eventId = await exports.createGoogleCalendarEvent(userId, reminder);
                    reminder.googleEventId = eventId;
                    reminder.source = 'google';
                    await reminder.save();
                    console.log(`[GoogleSync] Synced reminder: ${reminder.title}`);
                }
            } catch (err) {
                console.error(`[GoogleSync] Failed to sync reminder ${reminder._id}:`, err.message);
            }
        }
    } catch (error) {
        console.error("[GoogleSync] SyncAllReminders failed:", error.message);
    }
};

/**
 * Helper to sync a single reminder if user has Google Calendar connected.
 */
exports.syncReminder = async (user, reminderData) => {
    if (!user || !user.googleRefreshToken) return null;
    try {
        console.log(`[GoogleSync] Pushing reminder "${reminderData.title}" to Google Calendar...`);
        const eventId = await exports.createGoogleCalendarEvent(user._id, reminderData);
        return eventId;
    } catch (err) {
        console.error(`[GoogleSync] Failed for reminder "${reminderData.title}":`, err.message);
        return null;
    }
};


