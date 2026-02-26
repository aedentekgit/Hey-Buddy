import requests
import uuid

BASE_URL = "http://localhost:5001"
TIMEOUT = 30

def test_reminder_creation_and_retrieval():
    # Helper functions for registration and login
    def register_user(email, password, name="Test User"):
        url = f"{BASE_URL}/api/auth/signup"
        payload = {"name": name, "email": email, "password": password}
        resp = requests.post(url, json=payload, timeout=TIMEOUT)
        return resp

    def login_user(email, password):
        url = f"{BASE_URL}/api/auth/login"
        payload = {"email": email, "password": password}
        resp = requests.post(url, json=payload, timeout=TIMEOUT)
        return resp

    # Register a new user and login to obtain token
    test_email = f"test{uuid.uuid4().hex[:8]}@example.com"
    test_password = "TestPass123!"
    reg_resp = register_user(test_email, test_password)
    assert reg_resp.status_code == 201, f"Registration failed: {reg_resp.text}"
    token = reg_resp.json().get("data", {}).get("token")
    assert token, "No token received on registration"

    # Also test login with same credentials to confirm login endpoint correctness
    login_resp = login_user(test_email, test_password)
    assert login_resp.status_code == 200, f"Login failed: {login_resp.text}"
    token_login = login_resp.json().get("data", {}).get("token")
    assert token_login, "No token received on login"
    # Use same token as registered (or from login)
    auth_token = token_login

    headers = {"Authorization": f"Bearer {auth_token}"}

    # 1) Test GET /api/reminders without token: expect 401 Unauthorized
    get_no_auth = requests.get(f"{BASE_URL}/api/reminders", timeout=TIMEOUT)
    assert get_no_auth.status_code == 401, "GET /api/reminders without auth should be 401"

    # 2) Test GET /api/reminders with valid token: expect 200 and list (likely empty)
    get_with_auth = requests.get(f"{BASE_URL}/api/reminders", headers=headers, timeout=TIMEOUT)
    assert get_with_auth.status_code == 200, f"GET /api/reminders failed with auth: {get_with_auth.text}"
    reminders_list = get_with_auth.json()
    assert isinstance(reminders_list.get("data"), list), "Reminders response should be a list"

    # Prepare valid reminder data for POST
    valid_reminder_payload = {
        "title": "Test Reminder",
        "date": "2099-12-31", "time": "10:00 AM",
        "notes": "This is a test reminder note."
    }

    # 3) Test POST /api/reminders with valid data: expect 201 Created and reminder object with ID
    post_resp = requests.post(f"{BASE_URL}/api/reminders", json=valid_reminder_payload, headers=headers, timeout=TIMEOUT)
    assert post_resp.status_code == 201, f"POST valid reminder failed: {post_resp.text}"
    post_data = post_resp.json()
    reminder_id = post_data.get("data", {}).get("_id")
    assert reminder_id, "Created reminder response missing ID"

    # 4) Test GET /api/reminders again to confirm the new reminder is listed
    get_after_post = requests.get(f"{BASE_URL}/api/reminders", headers=headers, timeout=TIMEOUT)
    assert get_after_post.status_code == 200, f"GET /api/reminders failed after post: {get_after_post.text}"
    reminders_post = get_after_post.json()
    assert any((r.get("id") == reminder_id or r.get("_id") == reminder_id) for r in reminders_post.get("data", [])), "New reminder not found in list"

    # 5) Test POST /api/reminders with invalid data (missing datetime): expect 400 Bad Request
    invalid_reminder_payload = {
        "title": "Invalid Reminder",
        "notes": "No datetime field"
    }
    invalid_post_resp = requests.post(f"{BASE_URL}/api/reminders", json=invalid_reminder_payload, headers=headers, timeout=TIMEOUT)
    assert invalid_post_resp.status_code == 400, f"POST invalid reminder did not fail as expected: {invalid_post_resp.text}"
    invalid_resp_json = invalid_post_resp.json()
    assert "date" in str(invalid_resp_json).lower() or "datetime" in str(invalid_resp_json).lower(), "Error message should mention missing date/time"

    # Cleanup: delete the created reminder to keep test environment clean
    try:
        del_resp = requests.delete(f"{BASE_URL}/api/reminders/{reminder_id}", headers=headers, timeout=TIMEOUT)
        # Allow 204 No Content or 200 OK depending on API implementation
        assert del_resp.status_code in (200, 204), f"Failed to delete reminder id={reminder_id}: {del_resp.text}"
    except Exception as e:
        pass  # If cleanup fails, tests still reflect reminder endpoints behavior

test_reminder_creation_and_retrieval()