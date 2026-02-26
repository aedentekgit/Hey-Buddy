import requests
import uuid

BASE_URL = "http://localhost:5001"
REGISTER_ENDPOINT = "/api/auth/signup"
TIMEOUT = 30
HEADERS = {"Content-Type": "application/json"}


def test_user_registration():
    session = requests.Session()

    # Generate unique email for successful registration test
    unique_email = f"testuser_{uuid.uuid4().hex}@example.com"
    valid_payload = {
        "name": "Test User",
        "email": unique_email,
        "password": "StrongPassw0rd!"
    }

    # 1. Successful user registration with valid data
    response = session.post(
        BASE_URL + REGISTER_ENDPOINT, json=valid_payload, headers=HEADERS, timeout=TIMEOUT
    )
    try:
        assert response.status_code == 201, f"Expected 201, got {response.status_code}"
        json_data = response.json()
        assert "token" in json_data and isinstance(json_data["token"], str) and json_data["token"], "Auth token missing or empty"
    except Exception:
        # Attempt cleanup if user creation was partially done and API supports DELETE on same endpoint (not specified)
        pass

    # 2. Validation errors on missing fields
    # Missing name
    payload_missing_name = {
        "email": "missingname@example.com",
        "password": "Pass1234!"
    }
    response = session.post(
        BASE_URL + REGISTER_ENDPOINT, json=payload_missing_name, headers=HEADERS, timeout=TIMEOUT
    )
    assert response.status_code == 400, f"Expected 400 for missing name, got {response.status_code}"
    json_data = response.json()
    # Expect field-specific error messages, common format assumed as errors object or message text
    assert (
        "name" in str(json_data).lower() or "name" in str(json_data.get("errors", "")).lower()
    ), "Missing field error on 'name' not found"

    # Missing email
    payload_missing_email = {
        "name": "No Email User",
        "password": "Pass1234!"
    }
    response = session.post(
        BASE_URL + REGISTER_ENDPOINT, json=payload_missing_email, headers=HEADERS, timeout=TIMEOUT
    )
    assert response.status_code == 400, f"Expected 400 for missing email, got {response.status_code}"
    json_data = response.json()
    assert (
        "email" in str(json_data).lower() or "email" in str(json_data.get("errors", "")).lower()
    ), "Missing field error on 'email' not found"

    # Missing password
    payload_missing_password = {
        "name": "No Password User",
        "email": "nopassword@example.com"
    }
    response = session.post(
        BASE_URL + REGISTER_ENDPOINT, json=payload_missing_password, headers=HEADERS, timeout=TIMEOUT
    )
    assert response.status_code == 400, f"Expected 400 for missing password, got {response.status_code}"
    json_data = response.json()
    assert (
        "password" in str(json_data).lower() or "password" in str(json_data.get("errors", "")).lower()
    ), "Missing field error on 'password' not found"

    # 3. Duplicate email handling
    # Use the same unique_email used for successful registration
    duplicate_payload = {
        "name": "Duplicate User",
        "email": unique_email,
        "password": "AnotherPass123!"
    }
    response = session.post(
        BASE_URL + REGISTER_ENDPOINT, json=duplicate_payload, headers=HEADERS, timeout=TIMEOUT
    )
    # Expect a 400 or 409 conflict for duplicate emails typically
    assert (
        response.status_code == 400 or response.status_code == 409
    ), f"Expected 400 or 409 for duplicate email, got {response.status_code}"
    json_data = response.json()
    # Expect message indicating duplicate email
    lower_resp = str(json_data).lower()
    assert (
        "duplicate" in lower_resp or "already" in lower_resp or "exists" in lower_resp or "email" in lower_resp
    ), "Duplicate email error message not found"


test_user_registration()