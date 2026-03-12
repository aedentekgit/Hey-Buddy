// Start the Orb Engine using the imported class from buddy-orb-standalone.js
const myOrb = new OrbComponent('orb-container', {
    hue: 180,                 // Adjusted hue for a slightly different look in light mode
    hoverIntensity: 0.3,      // How aggressively it wiggles when "Speaking"
    backgroundColor: [0.96, 0.97, 0.98] // Light theme background (matches #f5f7fa roughly)
});

/**
 * Triggers the energized swirling animation representing TTS audio playback
 */
function simulateSpeaking() {
    // setActive(true) tells the WebGL engine to render the fast pulsing shape.
    myOrb.setActive(true);
}

/**
 * Returns the Orb to its slow, ambient background state
 */
function simulateIdle() {
    // setActive(false) tells the engine to calm down the wave amplitude and spin.
    myOrb.setActive(false);
}
