/**
 * Utility functions for date and time formatting
 */

/**
 * Formats a time string (HH:mm) into a 12-hour format string (hh:mm AM/PM).
 * @param {string} timeStr - The time string to format (e.g., "15:00" or "09:00").
 * @returns {string} The formatted time string.
 */
export const formatTime = (timeStr) => {
    if (!timeStr) return 'All Day';
    try {
        // If it's already in 12-hour format with AM/PM, return it
        if (timeStr.toLowerCase().includes('am') || timeStr.toLowerCase().includes('pm')) {
            return timeStr;
        }

        // Check if it's HH:mm format
        if (timeStr.includes(':')) {
            const parts = timeStr.split(':');
            const h = parseInt(parts[0]);
            const mins = parts[1].substring(0, 2); // Ensure we only get the minutes
            const ampm = h >= 12 ? 'PM' : 'AM';
            const h12 = h % 12 || 12;
            return `${h12}:${mins} ${ampm}`;
        }
    } catch (e) {
        console.error('Error formatting time:', e);
        return timeStr;
    }
    return timeStr;
};

/**
 * Formats a Date object or string into a localized date string.
 * @param {Date|string} date - The date to format.
 * @returns {string} The formatted date string.
 */
export const formatDate = (date) => {
    if (!date) return 'No date';
    const d = new Date(date);
    return d.toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
    });
};
