const path = require('path');
// Load dotenv
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const { getFallbackKey } = require('../../utils/configHelper');

function assert(condition, message) {
    if (!condition) {
        console.error(`❌ ASSERTION FAILED: ${message}`);
        process.exit(1);
    } else {
        console.log(`✅ Passed: ${message}`);
    }
}

async function runTests() {
    console.log("=== STARTING FULLY DYNAMIC ISOLATION DIAGNOSTIC TESTS ===");

    // Save initial state
    const originalEnv = process.env.NODE_ENV;
    const testKeyName = 'GEMINI_API_KEY';

    try {
        // Test Case 1: Development Environment (Must block env fallbacks entirely now!)
        process.env.NODE_ENV = 'development';
        const devResult = getFallbackKey(testKeyName);
        assert(devResult === null, `In "development" mode, getFallbackKey must block the key and return null. Got: "${devResult}"`);

        // Test Case 2: Production Environment (Must block env fallbacks)
        process.env.NODE_ENV = 'production';
        const prodResult = getFallbackKey(testKeyName);
        assert(prodResult === null, `In "production" mode, getFallbackKey must block the key and return null. Got: "${prodResult}"`);

        // Test Case 3: Staging Environment (Must block env fallbacks)
        process.env.NODE_ENV = 'staging';
        const stagingResult = getFallbackKey(testKeyName);
        assert(stagingResult === null, `In "staging" mode, getFallbackKey must block the key and return null. Got: "${stagingResult}"`);

        console.log("\n✨ ALL FULLY DYNAMIC ISOLATION TESTS PASSED SUCCESSFULLY! Env fallbacks are 100% disabled in all environments.");
    } finally {
        // Restore initial state
        process.env.NODE_ENV = originalEnv;
    }
}

runTests().catch(err => {
    console.error("Test execution failed:", err);
    process.exit(1);
});
