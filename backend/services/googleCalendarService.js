const { google } = require('googleapis');
const User = require('../models/User');
const Settings = require('../models/Settings');

async function getGoogleCredentials() {
    const settings = await Settings.findOne();
    const googleConfig = settings?.googleCalendar;
    const activeAccount = googleConfig?.activeAccount || 'personal';
    const accountConfig = googleConfig?.accounts?.[activeAccount];

    return {
        clientId: accountConfig?.clientId || process.env.GOOGLE_CLIENT_ID,
        clientSecret: accountConfig?.clientSecret || process.env.GOOGLE_CLIENT_SECRET,
        redirectUri: accountConfig?.redirectUri || process.env.GOOGLE_REDIRECT_URI
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
            start: { dateTime: startDateTime.toISOString(), timeZone: 'Asia/Kolkata' },
            end: { dateTime: endDateTime.toISOString(), timeZone: 'Asia/Kolkata' },
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
            start: { dateTime: startDateTime.toISOString(), timeZone: 'Asia/Kolkata' },
            end: { dateTime: endDateTime.toISOString(), timeZone: 'Asia/Kolkata' },
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
