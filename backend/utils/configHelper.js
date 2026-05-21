/**
 * Safely fetches a fallback API key or configuration value from environment variables.
 * In a professional production environment, fallback keys are disabled to ensure that
 * the database configuration is the single, authoritative source of truth.
 *
 * @param {string} envVarName - The name of the environment variable (e.g. 'GEMINI_API_KEY')
 * @returns {string|null} - The fallback key if in development/test, or null if in production
 */
exports.getFallbackKey = (envVarName) => {
    // Dynamic Configuration Only:
    // In a professional application, fallback keys from environment variables are completely disabled
    // across all environments. The system must rely entirely on dynamic database configuration.
    console.warn(`[Dynamic Config] Attempted to load environment fallback for "${envVarName}". Environment fallbacks are fully disabled; dynamic database configuration is strictly enforced.`);
    return null;
};
