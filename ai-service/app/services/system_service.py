import os
import re
import subprocess
import webbrowser
import logging
import platform

logger = logging.getLogger("Hey buddy")

# Allowlist of characters permitted in an app name to prevent command injection.
# Only alphanumeric, spaces, dots, hyphens, and underscores are allowed.
_APP_NAME_RE = re.compile(r'^[\w\s.\-]+$')

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
        """Open an application (macOS / Linux / Windows).

        SECURITY: app_name is validated against a strict allowlist before being
        passed to any subprocess call. This prevents command injection attacks
        where a malicious AI response could embed shell metacharacters.
        """
        # --- Input validation ---
        if not app_name or not _APP_NAME_RE.match(app_name):
            logger.warning(f"[SYSTEM] Rejected app name with unsafe characters: {app_name!r}")
            return False

        system = platform.system()
        logger.info(f"[SYSTEM] Opening App: {app_name!r} on {system}")

        try:
            if system == "Darwin":  # macOS
                subprocess.run(["open", "-a", app_name], check=True)
            elif system == "Windows":
                # SECURITY: shell=True removed — pass the executable directly.
                # 'start' is a shell built-in so we use cmd.exe /c start instead,
                # but still without user-controlled shell expansion.
                subprocess.run(["cmd.exe", "/c", "start", "", app_name], check=True)
            else:
                # Try generic xdg-open for Linux
                subprocess.run(["xdg-open", app_name], check=True)
            return True
        except Exception as e:
            logger.error(f"[SYSTEM] Failed to open app {app_name!r}: {e}")
            return False

    def search_system(self, query: str):
        """Perform a system-level search (Spotlight on Mac)."""
        if platform.system() == "Darwin":
            logger.info(f"[SYSTEM] Spotlight Search: {query}")
            # Note: this only opens Spotlight; it does not pass query as a shell argument.
            subprocess.run(
                ["osascript", "-e",
                 'tell application "System Events" to keystroke space using command down'],
                check=True
            )
            return True
        return False
