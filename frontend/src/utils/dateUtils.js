/**
 * Utility functions for date and time formatting
 */

/**
 * Formats a time string (HH:mm) into a 12-hour format string (hh:mm AM/PM).
 * @param {string} timeStr - The time string to format (e.g., "15:00" or "09:00").
 * @returns {string} The formatted time string.
 */
export const formatTime = (timeInput, format = '12') => {
    if (!timeInput) return 'All Day';
    try {
        let h, mins;

        if (timeInput instanceof Date) {
            h = timeInput.getHours();
            mins = timeInput.getMinutes().toString().padStart(2, '0');
        } else if (typeof timeInput === 'string') {
            // If it's likely a full ISO string
            if (timeInput.includes('T') && (timeInput.includes('Z') || timeInput.includes('+'))) {
                const d = new Date(timeInput);
                h = d.getHours();
                mins = d.getMinutes().toString().padStart(2, '0');
            } else if (timeInput.includes(':')) {
                const parts = timeInput.split(':');
                h = parseInt(parts[0]);
                mins = parts[1].substring(0, 2);
            } else {
                return timeInput;
            }
        } else {
            return String(timeInput);
        }

        if (format === '24') {
            return `${h.toString().padStart(2, '0')}:${mins}`;
        } else {
            // 12 hour format
            const ampm = h >= 12 ? 'PM' : 'AM';
            const h12 = h % 12 || 12;
            return `${h12}:${mins} ${ampm}`;
        }
    } catch (e) {
        console.error('Error formatting time:', e);
        return String(timeInput);
    }
};

/**
 * Formats a Date object or string into a localized date string based on preference.
 * @param {Date|string} date - The date to format.
 * @param {string} format - The format string ('DD/MM/YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD').
 * @returns {string} The formatted date string.
 */
export const formatDate = (date, format = 'DD/MM/YYYY') => {
    if (!date) return 'No date';
    const d = new Date(date);
    if (isNaN(d.getTime())) return date; // Return original if invalid date

    const day = d.getDate().toString().padStart(2, '0');
    const month = (d.getMonth() + 1).toString().padStart(2, '0');
    const year = d.getFullYear();

    switch (format) {
        case 'MM/DD/YYYY':
            return `${month}/${day}/${year}`;
        case 'YYYY-MM-DD':
            return `${year}-${month}-${day}`;
        case 'DD/MM/YYYY':
        default:
            return `${day}/${month}/${year}`;
    }
};
