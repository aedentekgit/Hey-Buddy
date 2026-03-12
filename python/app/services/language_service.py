import re
import logging

logger = logging.getLogger("Hey buddy")

class LanguageService:
    """
    Service for detecting the language of a text and mapping it to a suitable TTS voice.
    """

    # Mapping of BCP-47 language codes to edge-tts voice IDs.
    # Prefer male voices for the default mapping
    VOICE_MAPPING_MALE = {
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
        "pa": "hi-IN-MadhurNeural",    # Punjabi
        "es": "es-ES-AlvaroNeural",    # Spanish
        "fr": "fr-FR-RemyNeural",      # French
        "de": "de-DE-KillianNeural",   # German
        "it": "it-IT-DiegoNeural",     # Italian
        "ja": "ja-JP-KeitaNeural",     # Japanese
        "ko": "ko-KR-HyunsuNeural",    # Korean
        "zh": "zh-CN-YunyangNeural",   # Chinese (Mandarin)
    }

    # Female voices for Buddy (Aoede persona)
    VOICE_MAPPING_FEMALE = {
        "en": "en-GB-SoniaNeural",     # English (UK)
        "hi": "hi-IN-SwaraNeural",     # Hindi
        "ta": "ta-IN-PallaviNeural",   # Tamil
        "te": "te-IN-ShrutiNeural",    # Telugu
        "kn": "kn-IN-SapnaNeural",     # Kannada
        "ml": "ml-IN-SobhanaNeural",   # Malayalam
        "bn": "bn-IN-TanishaNeural",   # Bengali
        "gu": "gu-IN-DhwaniNeural",    # Gujarati
        "mr": "mr-IN-AarohiNeural",    # Marathi
        "ur": "ur-IN-GulNeural",       # Urdu
        "pa": "hi-IN-SwaraNeural",     # Punjabi
        "es": "es-ES-ElviraNeural",    # Spanish
        "fr": "fr-FR-DeniseNeural",    # French
        "de": "de-DE-KatjaNeural",     # German
        "it": "it-IT-ElsaNeural",      # Italian
        "ja": "ja-JP-NanamiNeural",    # Japanese
        "ko": "ko-KR-SunHiNeural",     # Korean
        "zh": "zh-CN-XiaoxiaoNeural",  # Chinese (Mandarin)
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

        # If it's mostly ASCII, it's likely English
        return "en"

    def get_voice_for_text(self, text: str, gender: str = "male", default_voice: str = None) -> str:
        """
        Detect the language of the text and return the corresponding voice ID.
        """
        lang = self.detect_language(text)
        
        if gender.lower() == "female":
            mapping = self.VOICE_MAPPING_FEMALE
            default = default_voice or "en-GB-SoniaNeural"
        else:
            mapping = self.VOICE_MAPPING_MALE
            default = default_voice or "en-GB-RyanNeural"
            
        voice = mapping.get(lang, default)
        logger.info(f"[LANG] Detected: {lang} | Gender: {gender} | Selected Voice: {voice}")
        return voice
