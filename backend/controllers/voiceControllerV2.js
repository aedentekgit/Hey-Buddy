const nluService = require('../services/nluService');
const contextService = require('../services/contextService');
const Reminder = require('../models/Reminder');
const { createGoogleCalendarEvent } = require('../services/googleCalendarService');

/**
 * Buddy 2.0 Voice Controller
 * Orchestrates the full NLU -> Context -> Response flow
 */
exports.processVoice = async (req, res) => {
    try {
        const { text, language = 'en-US', conversationId = null } = req.body;
        const userId = req.user?._id;

        if (!text) {
            return res.status(400).json({ success: false, message: "No text captured." });
        }

        console.log(`[VoiceV2] Processing: "${text}" for user ${userId}`);

        // 1. Get Context (Step 5)
        const context = await contextService.getContext(userId, conversationId);

        // 2. Generate Response (Steps 4 & 6)
        const aiResponse = await nluService.generateResponse(text, context, language);

        // 3. Save Context (Step 5)
        const updatedConversationId = await contextService.saveInteraction(
            userId,
            conversationId,
            text,
            aiResponse.reply
        );

        // 4. Return result (ready for Steps 7 & 8 on frontend)
        res.status(200).json({
            success: true,
            data: aiResponse,
            meta: {
                conversationId: updatedConversationId,
                language: language
            }
        });

    } catch (error) {
        console.error('[VoiceV2] Fatal Error:', error);
        res.status(500).json({ success: false, message: "Internal processing error." });
    }
};

/**
 * Keep the existing reminder saving logic for compatibility
 */
exports.saveReminder = async (req, res) => {
    try {
        const { reminderData, saveTo } = req.body;
        const userId = req.user?._id;

        let googleEventId = null;
        if (saveTo === 'google' || saveTo === 'both') {
            try {
                googleEventId = await createGoogleCalendarEvent(userId, reminderData);
            } catch (err) {
                console.error("Google Calendar Sync failed:", err);
            }
        }

        const reminder = await Reminder.create({
            userId,
            ...reminderData,
            googleEventId,
            source: googleEventId ? 'google' : 'buddy'
        });

        res.status(201).json({ success: true, data: reminder });
    } catch (error) {
        res.status(500).json({ success: false, message: "Failed to save reminder." });
    }
};
