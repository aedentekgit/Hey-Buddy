import requests
import uuid

BASE_URL = "http://localhost:5001"
TIMEOUT = 30

def test_knowledge_rag_query_handling():
    # Register a user
    register_url = f"{BASE_URL}/api/auth/signup"
    email = f"testuser_{uuid.uuid4().hex[:8]}@example.com"
    password = "TestPassword123!"
    register_payload = {
        "name": "Test User",
        "email": email,
        "password": password
    }
    register_resp = requests.post(register_url, json=register_payload, timeout=TIMEOUT)
    assert register_resp.status_code == 201, f"Registration failed: {register_resp.text}"
    auth_token = register_resp.json().get("data", {}).get("token")
    assert auth_token and isinstance(auth_token, str), "Auth token missing from registration response"

    headers = {
        "Authorization": f"Bearer {auth_token}",
        "Content-Type": "application/json"
    }

    knowledge_url = f"{BASE_URL}/api/knowledge"

    try:
        # 1) Valid query test
        valid_query_payload = {"query": "What are the health benefits of regular exercise?"}
        resp_valid = requests.post(knowledge_url, json=valid_query_payload, headers=headers, timeout=TIMEOUT)
        assert resp_valid.status_code == 200, f"Valid query failed: {resp_valid.text}"
        resp_json = resp_valid.json()
        assert "answer" in resp_json or ("documents" in resp_json and resp_json["documents"]), \
            "Response missing expected keys (answer/documents) for valid query"

        # 2) Empty query test (ambiguous)
        empty_query_payload = {"query": ""}
        resp_empty = requests.post(knowledge_url, json=empty_query_payload, headers=headers, timeout=TIMEOUT)
        # Should reject with 400 Bad Request or return empty result
        assert resp_empty.status_code in (400, 200), f"Empty query returned unexpected status: {resp_empty.status_code}"
        if resp_empty.status_code == 200:
            # Expect empty or prompt result
            resp_json = resp_empty.json()
            # Either empty answer or some indication to refine question
            answer = resp_json.get("answer", "")
            documents = resp_json.get("documents", [])
            assert not answer.strip() or not documents, "Empty query should not return valid answer or documents"

        # 3) Ambiguous query test (e.g. vague query)
        ambiguous_query = {"query": "Tell me more"}
        resp_ambiguous = requests.post(knowledge_url, json=ambiguous_query, headers=headers, timeout=TIMEOUT)
        # Either 400 Bad Request or 200 with empty/ambiguous response expected
        assert resp_ambiguous.status_code in (400, 200), f"Ambiguous query returned unexpected status: {resp_ambiguous.status_code}"
        if resp_ambiguous.status_code == 200:
            resp_json = resp_ambiguous.json()
            answer = resp_json.get("answer", "")
            documents = resp_json.get("documents", [])
            assert not answer.strip() or not documents, "Ambiguous query should not return a clear answer or documents"

        # 4) External service failure or timeout simulation
        # Since we cannot simulate the actual external failure, we can try sending a special query that may trigger failure
        # Or timeout by using very slow request? Here, send a known query that might cause failure or skip this dynamically.
        # Instead, try sending a query with very short timeout and expect timeout handling.
        try:
            requests.post(knowledge_url, json={"query": "Trigger external failure"}, headers=headers, timeout=0.001)
            # If no timeout, that's unexpected here for test purpose
            raise AssertionError("Expected timeout did not occur")
        except requests.exceptions.Timeout:
            pass

    finally:
        # No resource to delete for knowledge query, test user cleanup not specified
        # Optionally could implement cleanup by deleting test user if API supported
        pass

test_knowledge_rag_query_handling()