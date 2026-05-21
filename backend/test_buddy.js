const BuddyAgent = require('./agents/BuddyAgent');
const mongoose = require('mongoose');

async function test() {
    try {
        console.log("Loading BuddyAgent...");
        // just trying to instantiate
        const agent = new BuddyAgent('6a0d8762b53bed3f9f370ad4', { emit: () => {}, on: () => {} }, 'en-US');
        console.log("Instantiated.");
        await agent.processMessage("hello");
        console.log("Processed.");
    } catch (e) {
        console.error(e);
    }
}
test();
