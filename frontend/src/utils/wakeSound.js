let sharedAudioContext = null;

/**
 * Initializes the global AudioContext.
 * MUST be called during a user gesture (click/tap) to satisfy browser autoplay policies.
 */
export const initAudio = async () => {
    if (!sharedAudioContext) {
        sharedAudioContext = new (window.AudioContext || window.webkitAudioContext)();
    }

    if (sharedAudioContext.state === 'suspended') {
        await sharedAudioContext.resume();
    }

    // Test beep (silent) to fully unlock on some mobile browsers
    const osc = sharedAudioContext.createOscillator();
    const gain = sharedAudioContext.createGain();
    gain.gain.value = 0;
    osc.connect(gain);
    gain.connect(sharedAudioContext.destination);
    osc.start(0);
    osc.stop(0.1);

    return sharedAudioContext;
};

// Wake sound generator - creates a pleasant chime similar to voice assistants
// Wake sound generator - simple single tone
export const playWakeSound = () => {
    try {
        if (!sharedAudioContext) {
            sharedAudioContext = new (window.AudioContext || window.webkitAudioContext)();
        }

        if (sharedAudioContext.state === 'suspended') {
            sharedAudioContext.resume().catch(e => console.warn("AudioContext resume failed:", e));
        }

        // Create oscillator for a single pleasant tone
        const oscillator1 = sharedAudioContext.createOscillator();
        const gainNode1 = sharedAudioContext.createGain();
        const masterGain = sharedAudioContext.createGain();

        // Set frequency (E5)
        oscillator1.frequency.setValueAtTime(800, sharedAudioContext.currentTime);
        oscillator1.type = 'sine';

        // Connect the audio graph
        oscillator1.connect(gainNode1);
        gainNode1.connect(masterGain);
        masterGain.connect(sharedAudioContext.destination);

        // Set initial volumes
        const now = sharedAudioContext.currentTime;
        masterGain.gain.setValueAtTime(0.6, now);

        // Create envelope (quick attack, medium decay)
        gainNode1.gain.setValueAtTime(0, now);
        gainNode1.gain.linearRampToValueAtTime(1, now + 0.02); // Fast attack
        gainNode1.gain.exponentialRampToValueAtTime(0.01, now + 0.3); // Decay

        // Start and stop oscillator
        oscillator1.start(now);
        oscillator1.stop(now + 0.35);

    } catch (error) {
        console.error('Error playing wake sound:', error);
    }
};

// Alternative wake sound with a more subtle single tone
export const playWakeSoundSubtle = () => {
    try {
        if (!sharedAudioContext) {
            sharedAudioContext = new (window.AudioContext || window.webkitAudioContext)();
        }

        if (sharedAudioContext.state === 'suspended') return;

        const oscillator = sharedAudioContext.createOscillator();
        const gainNode = sharedAudioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(sharedAudioContext.destination);

        // Pleasant frequency
        oscillator.frequency.setValueAtTime(1000, sharedAudioContext.currentTime);
        oscillator.type = 'sine';

        // Quick fade in and out
        const now = sharedAudioContext.currentTime;
        gainNode.gain.setValueAtTime(0, now);
        gainNode.gain.linearRampToValueAtTime(0.2, now + 0.02);
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.2);

        oscillator.start(now);
        oscillator.stop(now + 0.25);
    } catch (error) {
        console.error('Error playing wake sound:', error);
    }
};
