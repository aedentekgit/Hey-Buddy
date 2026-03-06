import os
import subprocess
import webbrowser
import logging
import platform

logger = logging.getLogger("Hey buddy")

class SystemService:
    """
    Handles system-level actions triggered by Hey buddy.
    """
    
    def open_url(self, url: str):
        """Open a URL in the default browser."""
        if not url.startswith(("http://", "https://")):
            url = "https://" + url
        logger.info(f"[SYSTEM] Opening URL: {url}")
        webbrowser.open(url)
        return True

    def open_app(self, app_name: str):
        """Open an application (macOS specific for now)."""
        system = platform.system()
        logger.info(f"[SYSTEM] Opening App: {app_name} on {system}")
        
        try:
            if system == "Darwin":  # macOS
                subprocess.run(["open", "-a", app_name], check=True)
            elif system == "Windows":
                subprocess.run(["start", app_name], shell=True, check=True)
            else:
                # Try generic xdg-open for Linux
                subprocess.run(["xdg-open", app_name], check=True)
            return True
        except Exception as e:
            logger.error(f"[SYSTEM] Failed to open app {app_name}: {e}")
            return False

    def search_system(self, query: str):
        """Perform a system-level search (Spotlight on Mac)."""
        if platform.system() == "Darwin":
            logger.info(f"[SYSTEM] Spotlight Search: {query}")
            subprocess.run(["osascript", "-e", f'tell application "System Events" to keystroke space using command down'], check=True)
            # This is a bit hacky, but shows the intent of "Global Access"
            return True
        return False
