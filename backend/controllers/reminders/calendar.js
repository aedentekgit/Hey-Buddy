const { google } = require('googleapis');
const User = require('../../models/User');
const config = require('../../config/env');
const { syncAllReminders } = require('../../services/googleCalendarService');

// ─── Get Google Auth URL ───────────────────────────────────────────────────────
exports.getGoogleAuthUrl = async (req, res) => {
    try {
        const Settings = require('../../models/Settings');
        const settings = await Settings.findOne().select('+googleCalendar.clientSecret');

        const googleConfig = settings?.googleCalendar;

        const clientId = googleConfig?.clientId;
        const clientSecret = googleConfig?.clientSecret;
        const redirectUri = googleConfig?.redirectUri || config.GOOGLE_REDIRECT_URI;

        if (!clientId || !clientSecret) {
            return res.status(400).json({ success: false, message: "Google Calendar credentials not configured." });
        }

        const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
        const scopes = [
            'https://www.googleapis.com/auth/calendar.events',
            'https://www.googleapis.com/auth/calendar.readonly'
        ];
        const state = req.user._id.toString();
        const url = oauth2Client.generateAuthUrl({
            access_type: 'offline',
            scope: scopes,
            state: state,
            prompt: 'consent'
        });
        res.status(200).json({ success: true, url });
    } catch (error) {
        console.error("Auth URL Error:", error);
        res.status(500).json({ success: false, message: "Could not generate Auth URL" });
    }
};

// ─── Google Callback ──────────────────────────────────────────────────────────
exports.googleCallback = async (req, res) => {
    try {
        const { code, state: userId } = req.query;
        if (!code) return res.status(400).send("No code provided from Google");

        const Settings = require('../../models/Settings');
        const settings = await Settings.findOne().select('+googleCalendar.clientSecret');

        const googleConfig = settings?.googleCalendar;

        const clientId = googleConfig?.clientId;
        const clientSecret = googleConfig?.clientSecret;
        const redirectUri = googleConfig?.redirectUri || config.GOOGLE_REDIRECT_URI;

        if (!clientId || !clientSecret) {
            throw new Error('Google Calendar credentials not configured.');
        }

        const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
        const { tokens } = await oauth2Client.getToken(code);

        const updateData = {
            googleCalendarConnected: true
        };

        if (tokens.refresh_token) {
            updateData.googleRefreshToken = tokens.refresh_token;
            console.log('[Calendar Callback] New refresh token stored for user:', userId);
        } else {
            console.warn('[Calendar Callback] No refresh token in response. User may need to revoke access and reconnect.');
        }

        if (tokens.id_token) {
            try {
                const ticket = await oauth2Client.verifyIdToken({
                    idToken: tokens.id_token,
                    audience: clientId
                });
                const payload = ticket.getPayload();
                if (payload?.email) {
                    updateData.googleEmail = payload.email.toLowerCase();
                }
            } catch (idTokenErr) {
                console.warn('[Calendar Callback] Could not decode id_token for email:', idTokenErr.message);
            }
        }

        await User.findByIdAndUpdate(userId, updateData);
        console.log('[Calendar Callback] User', userId, 'calendar connected. Fields updated:', Object.keys(updateData).join(', '));

        // Retroactively sync all existing unsynced reminders
        syncAllReminders(userId).catch(err => console.error('[Calendar Callback] Background sync failed:', err));

        res.send(`
            <html>
                <body style="font-family: sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; background: #0f172a; color: white; margin: 0;">
                    <div style="text-align: center; background: #1e293b; padding: 3rem; border-radius: 24px;">
                        <h2 style="color: white; margin: 0 0 1rem;">Connected!</h2>
                        <p style="color: #94a3b8; margin-bottom: 2rem;">Your Google Calendar is now successfully linked.</p>
                        <script>
                            if (window.opener) window.opener.postMessage("GOOGLE_AUTH_SUCCESS", "*");
                            setTimeout(() => { window.close(); }, 3000);
                        </script>
                    </div>
                </body>
            </html>
        `);
    } catch (error) {
        console.error("Callback Error:", error);
        res.status(500).send("Authentication failed.");
    }
};