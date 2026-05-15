/**
 * Centralized Personality Mapping for Buddy
 * Ensures consistency between Voice names (Gemini), Writing Styles (NLP), and Personas.
 */

const PERSONALITIES = {
    'female_soft': {
        voice: 'Aoede', // Warm, soft female
        name: 'Aoede',
        tone: 'soft',
        fallbackLang: 'en-US',
        description: 'You are a warm health assistant. Your voice is soft and empathetic. NEVER narrate your thoughts. NEVER mention tools. Just give a direct, brief confirmation.',
        writingStyle: 'Gentle and empathetic. Short, soothing sentences.'
    },
    'female_energetic': {
        voice: 'Kore', // Bright female
        name: 'Kore',
        tone: 'energetic',
        fallbackLang: 'en-GB', // British accent sounds more energetic/sharp in some TTS engines
        description: 'You are a proactive coach. Your voice is bright and energetic. NEVER narrate your thoughts. NEVER mention tools. Just give a direct, brief confirmation.',
        writingStyle: 'Lively and upbeat. Short, motivating sentences.'
    },
    'male_soft': {
        voice: 'Charon', // Deep male
        name: 'Charon',
        tone: 'soft',
        fallbackLang: 'en-GB', // British Male (Ryan Neural style)
        description: 'You are a trusted mentor. Your voice is steady and calm. NEVER narrate your thoughts. NEVER mention tools. Just give a direct, brief confirmation.',
        writingStyle: 'Steady and wise. Keep sentences brief and useful.'
    },
    'male_energetic': {
        voice: 'Fenrir', // Strong male
        name: 'Fenrir',
        tone: 'energetic',
        fallbackLang: 'en-GB', // British Male (Ryan Neural style)
        description: 'You are a high-performance trainer. Your voice is strong and clear. NEVER narrate your thoughts. NEVER mention tools. Just give a direct, brief confirmation.',
        writingStyle: 'Strong and decisive. Short, high-energy sentences.'
    },
    'male_normal': {
        voice: 'Puck', // 'Ryan' is not supported by Gemini Live Native Audio model. 'Puck' is a good male alternative.
        name: 'Buddy',
        tone: 'normal',
        fallbackLang: 'en-GB', // Matches Python backend defaults
        description: 'You are Buddy, a British-accented professional assistant. Mature, professional, and balanced. NEVER explain your process, mention tools, or use bold headers. Just give a brief, professional response.',
        writingStyle: 'Professional and conversational. Short, balanced sentences.'
    },
    'female_normal': {
        voice: 'Aoede', // Default female
        name: 'Aoede',
        tone: 'normal',
        fallbackLang: 'en-US',
        description: 'You are Buddy, a professional health assistant. Balanced and clear. NEVER explain your process, mention tools, or use bold headers. Just give a clear, direct response.',
        writingStyle: 'Balanced, clear, and brief.'
    }
};

const getPersonality = (gender = 'male', tone = 'normal') => {
    const g = (gender || 'male').toLowerCase();
    const t = (tone || 'normal').toLowerCase();
    const key = `${g}_${t}`;

    const personality = PERSONALITIES[key] || PERSONALITIES['male_normal'];
    console.log(`[Personality] Resolved config for ${g}/${t} -> Key: ${key}, Voice: ${personality.voice}`);
    return personality;
};

const resolveVoiceConfig = (prefs, platform = 'web') => {
    const gender = prefs?.gender || 'male';
    const tone = prefs?.tone || 'normal';

    let pitch = 1.0;
    let speechRate = platform === 'mobile' ? 0.5 : 1.0;

    // Apply gender offsets
    if (gender === 'male') {
        pitch = 0.85;
    } else {
        pitch = 1.05;
    }

    // Apply tone offsets
    if (tone === 'soft') {
        speechRate = platform === 'mobile' ? 0.45 : 0.85;
        pitch -= 0.05;
    } else if (tone === 'energetic') {
        speechRate = platform === 'mobile' ? 0.6 : 1.15;
        pitch += 0.1;
    }

    return {
        pitch,
        speechRate
    };
};

module.exports = {
    PERSONALITIES,
    getPersonality,
    resolveVoiceConfig
};
