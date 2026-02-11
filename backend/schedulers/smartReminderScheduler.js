const cron = require('node-cron');
const { runSmartReminderChecks } = require('../services/smartReminderService');

/**
 * Smart Reminder Scheduler
 * Runs periodic checks for AI-powered reminder features
 */

let schedulerRunning = false;

/**
 * Start the smart reminder scheduler
 * Runs checks every 5 minutes
 */
function startSmartReminderScheduler() {
    if (schedulerRunning) {
        console.log('Smart reminder scheduler is already running.');
        return;
    }

    // Run every 5 minutes
    cron.schedule('*/5 * * * *', async () => {
        console.log('🤖 Smart Reminder Scheduler triggered at:', new Date().toISOString());
        try {
            await runSmartReminderChecks();
        } catch (error) {
            console.error('Error in smart reminder scheduler:', error);
        }
    });

    schedulerRunning = true;
    console.log('✅ Smart Reminder Scheduler started - Running every 5 minutes');

    // Run immediately on startup
    setTimeout(async () => {
        console.log('🚀 Running initial smart reminder check...');
        try {
            await runSmartReminderChecks();
        } catch (error) {
            console.error('Error in initial smart reminder check:', error);
        }
    }, 5000); // Wait 5 seconds after server start
}

module.exports = {
    startSmartReminderScheduler
};
