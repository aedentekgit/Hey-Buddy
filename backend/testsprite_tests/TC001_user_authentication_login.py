import requests

BASE_URL = "http://localhost:5001"
LOGIN_ENDPOINT = "/api/auth/login"
REGISTER_ENDPOINT = "/api/auth/signup"
TIMEOUT = 30

def test_user_authentication_login():
    # First register a user to use for login tests
    register_payload = {
        "name": "Test User",
        "email": "testuser_login@example.com",
        "password": "ValidPass123!"
    }
    try:
        # Register user (ignore already exists error)
        r_register = requests.post(
            BASE_URL + REGISTER_ENDPOINT,
            json=register_payload,
            timeout=TIMEOUT
        )
        assert r_register.status_code in (201, 400), f"Unexpected register status: {r_register.status_code}"
    except requests.RequestException as e:
        assert False, f"Registration request failed: {e}"

    # 1. Successful login with valid credentials
    login_payload_valid = {
        "email": register_payload["email"],
        "password": register_payload["password"]
    }
    try:
        r_login_valid = requests.post(
            BASE_URL + LOGIN_ENDPOINT,
            json=login_payload_valid,
            timeout=TIMEOUT
        )
        assert r_login_valid.status_code == 200, f"Expected 200 OK for valid login, got {r_login_valid.status_code}"
        token = r_login_valid.json().get("data", {}).get("token")
        assert token and isinstance(token, str) and len(token) > 0, "Auth token missing or invalid in valid login response"
    except requests.RequestException as e:
        assert False, f"Valid login request failed: {e}"

    # 2. Invalid password login attempt
    login_payload_invalid_password = {
        "email": register_payload["email"],
        "password": "WrongPassword!"
    }
    try:
        r_login_invalid = requests.post(
            BASE_URL + LOGIN_ENDPOINT,
            json=login_payload_invalid_password,
            timeout=TIMEOUT
        )
        assert r_login_invalid.status_code == 401, f"Expected 401 Unauthorized for invalid password, got {r_login_invalid.status_code}"
    except requests.RequestException as e:
        assert False, f"Invalid password login request failed: {e}"

    # 3. Missing fields in login payload (missing password)
    login_payload_missing_password = {
        "email": register_payload["email"],
    }
    try:
        r_login_missing = requests.post(
            BASE_URL + LOGIN_ENDPOINT,
            json=login_payload_missing_password,
            timeout=TIMEOUT
        )
        # Expect 400 Bad Request due to missing password
        assert r_login_missing.status_code == 400, f"Expected 400 Bad Request for missing password, got {r_login_missing.status_code}"
    except requests.RequestException as e:
        assert False, f"Missing fields login request failed: {e}"

test_user_authentication_login()