// Re-export all reminder controller functions for backward compatibility.
// Routes should migrate to importing directly from submodules for better tree-shaking.

const crud = require('./crud');
const sharing = require('./sharing');
const calendar = require('./calendar');
const travel = require('./travel');

// ─── CRUD + Calendar Stats + Adjusted Notification ────────────────────────────
exports.getReminders = crud.getReminders;
exports.createReminder = crud.createReminder;
exports.updateReminder = crud.updateReminder;
exports.deleteReminder = crud.deleteReminder;
exports.batchDeleteReminders = crud.batchDeleteReminders;
exports.getAdjustedNotification = crud.getAdjustedNotification;
exports.getCalendarStats = crud.getCalendarStats;

// ─── Sharing ──────────────────────────────────────────────────────────────────
exports.shareReminder = sharing.shareReminder;
exports.unshareReminder = sharing.unshareReminder;

// ─── Calendar ─────────────────────────────────────────────────────────────────
exports.getGoogleAuthUrl = calendar.getGoogleAuthUrl;
exports.googleCallback = calendar.googleCallback;

// ─── Travel ───────────────────────────────────────────────────────────────────
exports.getTravelStats = travel.getTravelStats;