const reasoningRegex = /(\b(I('|’)m|I\s+am)\s+(?:now\s+)?(focusing|focused|thinking|analyzing|interpreting|searching|checking|retrieving)|\bMy\s+plan\s+is\b|\bquery('|’)s\s+nature\b|\btimeframe\s+is\s+relevant\b|\bgiven\s+today('|’)s\s+date\b|\bI('|’)ll\s+(?:focus|initiate|be|use)|\bI\s+will\s+(search|check|look|use)|\blet\s+me\s+(search|check|look)|\bmy\s+primary\s+focus|\busing\s+the\s+.*tool|\bgoogle_search|\bsearch\s+for\b)/i;

const testPhrases = [
    "I'm now focused on retrieving the T20 World Cup 2026 format details.",
    "My plan is to use the `` tool for this, given the query's nature.",
    "The timeframe is relevant, given today's date is March 4, 2026.",
    "I'll focus on finding that for you.",
    "I am focusing on interpreting your request.",
    "Specifically, I'll initiate a search.",
    "The current CM in TN is M.K. Stalin.", // Should NOT match
    "Hello there, how can I help?" // Should NOT match
];

console.log('--- 🧪 REGEX SCRUBBER TEST (V2) 🧪 ---');
testPhrases.forEach((phrase, index) => {
    const isMatched = reasoningRegex.test(phrase);
    console.log(`[Test ${index + 1}] Phrase: "${phrase}"`);
    console.log(`Matched: ${isMatched ? '✅ BLOCKED' : '❌ ALLOWED'}`);
    console.log('---');
});
