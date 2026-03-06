import re
import logging

logger = logging.getLogger("Hey buddy")

class LanguageService:
    """
    Service for detecting the language of a text and mapping it to a suitable TTS voice.
    """

    # Mapping of BCP-47 language codes to edge-tts voice IDs.
    # We prefer male voices to match the "Hey buddy" persona where available.
    VOICE_MAPPING = {
        "en": "en-GB-RyanNeural",      # English (UK)
        "hi": "hi-IN-MadhurNeural",    # Hindi
        "ta": "ta-IN-ValluvarNeural",  # Tamil
        "te": "te-IN-MohanNeural",     # Telugu
        "kn": "kn-IN-GaganNeural",     # Kannada
        "ml": "ml-IN-MidhunNeural",    # Malayalam
        "bn": "bn-IN-BashkarNeural",   # Bengali
        "gu": "gu-IN-NiranjanNeural",  # Gujarati
        "mr": "mr-IN-ManoharNeural",   # Marathi
        "ur": "ur-IN-SalmanNeural",    # Urdu
        "pa": "hi-IN-MadhurNeural",    # Punjabi (fallback to Hindi if no direct voice)
        "es": "es-ES-AlvaroNeural",    # Spanish
        "fr": "fr-FR-RemyNeural",      # French
        "de": "de-DE-KillianNeural",   # German
        "it": "it-IT-DiegoNeural",     # Italian
        "ja": "ja-JP-KeitaNeural",     # Japanese
        "ko": "ko-KR-HyunsuNeural",    # Korean
        "zh": "zh-CN-YunyangNeural",   # Chinese (Mandarin)
    }

    # Unicode ranges for various scripts to help with detection
    RANGES = {
        "hi": r"[\u0900-\u097F]",  # Devanagari (Hindi, Marathi, etc.)
        "bn": r"[\u0980-\u09FF]",  # Bengali
        "gu": r"[\u0A80-\u0AFF]",  # Gujarati
        "ta": r"[\u0B80-\u0BFF]",  # Tamil
        "te": r"[\u0C00-\u0C7F]",  # Telugu
        "kn": r"[\u0C80-\u0CFF]",  # Kannada
        "ml": r"[\u0D00-\u0D7F]",  # Malayalam
    }

    def detect_language(self, text: str) -> str:
        """
        Detect the language of the given text using script-based heuristics.
        Defaults to "en" if no specific script is matched.
        """
        if not text:
            return "en"

        # Check for Indian scripts first
        for lang, pattern in self.RANGES.items():
            if re.search(pattern, text):
                return lang

        # If it's mostly ASCII, it's likely English (or another Latin-based language)
        # For this assistant, we assume English if no other script is found.
        return "en"

    def get_voice_for_text(self, text: str, default_voice: str = "en-GB-RyanNeural") -> str:
        """
        Detect the language of the text and return the corresponding voice ID.
        """
        lang = self.detect_language(text)
        voice = self.VOICE_MAPPING.get(lang, default_voice)
        logger.info(f"[LANG] Detected: {lang} | Selected Voice: {voice}")
        return voice
