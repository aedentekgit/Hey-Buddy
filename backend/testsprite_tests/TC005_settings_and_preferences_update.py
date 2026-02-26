import requests

BASE_URL = "http://localhost:5001"
TIMEOUT = 30

def test_settings_and_preferences_update():
    # Helper: register user
    def register_user(email, password, name="Test User"):
        resp = requests.post(
            f"{BASE_URL}/api/auth/signup",
            json={"name": name, "email": email, "password": password},
            timeout=TIMEOUT
        )
        resp.raise_for_status()
        return resp.json()["token"]

    # Helper: login user
    def login_user(email, password):
        resp = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": email, "password": password},
            timeout=TIMEOUT
        )
        resp.raise_for_status()
        return resp.json()["token"]

    # Create unique test user email to avoid conflicts
    import uuid
    test_email = f"testuser_{uuid.uuid4().hex}@example.com"
    test_password = "TestPass123!"

    # Register and login user to get valid token
    token = register_user(test_email, test_password)
    auth_header = {"Authorization": f"Bearer {token}"}

    # 1) Fetch user settings with valid token (GET /api/settings)
    resp_get = requests.get(f"{BASE_URL}/api/settings", headers=auth_header, timeout=TIMEOUT)
    assert resp_get.status_code == 200
    settings_before = resp_get.json()
    assert isinstance(settings_before, dict)

    # 2) Update preferences with valid data (PUT /api/settings)
    # Assuming settings accept arbitrary JSON fields for preferences, sample update:
    updated_preferences = {
        **settings_before,
        "reminderEnabled": not settings_before.get("reminderEnabled", False),
        "voiceAssistant": {
            "language": "en-US",
            "volume": 75
        }
    }
    resp_update = requests.put(
        f"{BASE_URL}/api/settings",
        headers={**auth_header, "Content-Type": "application/json"},
        json=updated_preferences,
        timeout=TIMEOUT
    )
    assert resp_update.status_code == 200
    settings_after = resp_update.json()
    assert isinstance(settings_after, dict)
    assert settings_after.get("voiceAssistant", {}).get("language") == "en-US"
    # Confirm that a changed boolean field was updated as well
    assert settings_after.get("reminderEnabled") == updated_preferences["reminderEnabled"]

    # 3) Update preferences with invalid data - expect 400 Bad Request (POST or PUT /api/settings)
    # Assuming "voiceAssistant.volume" must be 0-100, we set invalid value -10
    invalid_preferences = {
        **settings_after,
        "voiceAssistant": {
            "language": "en-US",
            "volume": -10
        }
    }
    resp_invalid = requests.put(
        f"{BASE_URL}/api/settings",
        headers={**auth_header, "Content-Type": "application/json"},
        json=invalid_preferences,
        timeout=TIMEOUT
    )
    assert resp_invalid.status_code == 400

    # 4) Attempt to fetch settings with expired/invalid token -> expect 401 Unauthorized
    invalid_auth_header = {"Authorization": "Bearer expired_or_invalid_token"}
    resp_expired_get = requests.get(f"{BASE_URL}/api/settings", headers=invalid_auth_header, timeout=TIMEOUT)
    assert resp_expired_get.status_code == 401

    # 5) Attempt to update settings with expired/invalid token -> expect 401 Unauthorized
    resp_expired_update = requests.put(
        f"{BASE_URL}/api/settings",
        headers={**invalid_auth_header, "Content-Type": "application/json"},
        json=updated_preferences,
        timeout=TIMEOUT
    )
    assert resp_expired_update.status_code == 401

test_settings_and_preferences_update()