#!/usr/bin/env node
/* eslint-disable no-console */

const BASE_URL = process.env.E2E_BASE_URL || 'http://127.0.0.1:5001';
const PLATFORM = 'web';

function fail(message, details) {
  const err = new Error(message);
  err.details = details;
  throw err;
}

function assertOk(condition, message, details) {
  if (!condition) fail(message, details);
}

async function request(method, path, { token, body, headers } = {}) {
  const finalHeaders = {
    Accept: 'application/json',
    ...headers,
  };
  if (body !== undefined) {
    finalHeaders['Content-Type'] = 'application/json';
  }
  if (token) {
    finalHeaders.Authorization = `Bearer ${token}`;
    finalHeaders['x-platform'] = PLATFORM;
  }

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: finalHeaders,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }

  return {
    status: res.status,
    ok: res.ok,
    json,
    text,
  };
}

function logStep(step) {
  console.log(`\n[E2E] ${step}`);
}

async function main() {
  const ts = Date.now();
  const userA = {
    name: `E2E User A ${ts}`,
    email: `e2e_user_a_${ts}@example.test`,
    password: 'Passw0rd!123',
  };
  const userB = {
    name: `E2E User B ${ts}`,
    email: `e2e_user_b_${ts}@example.test`,
    password: 'Passw0rd!123',
  };

  logStep('Health checks');
  const health = await request('GET', '/health');
  assertOk(health.status === 200, 'Backend health failed', health);
  const aiHealth = await request('GET', '/api/ai/health');
  assertOk(aiHealth.status === 200, 'AI health proxy failed', aiHealth);

  logStep('Signup user A');
  const signupA = await request('POST', '/api/auth/signup', { body: userA });
  assertOk(signupA.status === 201 && signupA.json?.success, 'Signup A failed', signupA);
  let tokenA = signupA.json.data.token;
  const userAId = signupA.json.data._id;

  logStep('Signup user B');
  const signupB = await request('POST', '/api/auth/signup', { body: userB });
  assertOk(signupB.status === 201 && signupB.json?.success, 'Signup B failed', signupB);
  let tokenB = signupB.json.data.token;
  const userBId = signupB.json.data._id;

  logStep('Login users');
  const loginA = await request('POST', '/api/auth/login', {
    body: { email: userA.email, password: userA.password },
    headers: { 'x-platform': PLATFORM },
  });
  assertOk(loginA.status === 200 && loginA.json?.success, 'Login A failed', loginA);
  tokenA = loginA.json.data.token;

  const loginB = await request('POST', '/api/auth/login', {
    body: { email: userB.email, password: userB.password },
    headers: { 'x-platform': PLATFORM },
  });
  assertOk(loginB.status === 200 && loginB.json?.success, 'Login B failed', loginB);
  tokenB = loginB.json.data.token;

  logStep('Auth profile check');
  const meA = await request('GET', '/api/auth/me', { token: tokenA });
  assertOk(meA.status === 200 && meA.json?.success, 'Auth /me failed', meA);

  logStep('Reminder CRUD + share/unshare');
  const reminderCreate = await request('POST', '/api/reminders', {
    token: tokenA,
    body: {
      title: `E2E reminder ${ts}`,
      description: 'E2E reminder flow',
      date: '2030-12-31',
      time: '09:30 AM',
      location: 'Mumbai',
      reminderType: 'time',
    },
  });
  assertOk(
    reminderCreate.status === 201 && reminderCreate.json?.success,
    'Create reminder failed',
    reminderCreate
  );
  const reminderId = reminderCreate.json.data._id;

  const reminderListA = await request('GET', '/api/reminders?limit=100', { token: tokenA });
  assertOk(reminderListA.status === 200 && reminderListA.json?.success, 'List reminders A failed', reminderListA);
  assertOk(
    (reminderListA.json?.data || []).some((r) => r._id === reminderId),
    'Created reminder not found in A list',
    reminderListA
  );

  const reminderUpdate = await request('PUT', `/api/reminders/${reminderId}`, {
    token: tokenA,
    body: { title: `E2E reminder updated ${ts}` },
  });
  assertOk(reminderUpdate.status === 200 && reminderUpdate.json?.success, 'Update reminder failed', reminderUpdate);

  const reminderShare = await request('POST', `/api/reminders/${reminderId}/share`, {
    token: tokenA,
    body: { email: userB.email, permissions: 'edit' },
  });
  assertOk(reminderShare.status === 200 && reminderShare.json?.success, 'Share reminder failed', reminderShare);

  const reminderListB = await request('GET', '/api/reminders?limit=100', { token: tokenB });
  assertOk(reminderListB.status === 200 && reminderListB.json?.success, 'List reminders B failed', reminderListB);
  assertOk(
    (reminderListB.json?.data || []).some((r) => r._id === reminderId),
    'Shared reminder not visible to user B',
    reminderListB
  );

  const reminderUnshare = await request('DELETE', `/api/reminders/${reminderId}/unshare/${userBId}`, {
    token: tokenA,
  });
  assertOk(reminderUnshare.status === 200 && reminderUnshare.json?.success, 'Unshare reminder failed', reminderUnshare);

  const reminderDelete = await request('DELETE', `/api/reminders/${reminderId}`, {
    token: tokenA,
  });
  assertOk(reminderDelete.status === 200 && reminderDelete.json?.success, 'Delete reminder failed', reminderDelete);

  logStep('Location reminder CRUD + actions');
  const locationCreate = await request('POST', '/api/location-reminders', {
    token: tokenA,
    body: {
      title: `E2E location ${ts}`,
      location: 'Delhi',
      description: 'E2E location flow',
    },
  });
  assertOk(
    locationCreate.status === 201 && locationCreate.json?.success,
    'Create location reminder failed',
    locationCreate
  );
  const locationReminderId = locationCreate.json.data._id;

  const locationGet = await request('GET', `/api/location-reminders/${locationReminderId}`, {
    token: tokenA,
  });
  assertOk(locationGet.status === 200 && locationGet.json?.success, 'Get location reminder failed', locationGet);

  const locationUpdate = await request('PUT', `/api/location-reminders/${locationReminderId}`, {
    token: tokenA,
    body: { status: 'risk_alert', warningLevel: 'high' },
  });
  assertOk(locationUpdate.status === 200 && locationUpdate.json?.success, 'Update location reminder failed', locationUpdate);

  const locationEarlyWarning = await request(
    'POST',
    `/api/location-reminders/${locationReminderId}/early-warning`,
    {
      token: tokenA,
      body: { bufferTime: 10, warningLevel: 'medium' },
    }
  );
  assertOk(
    locationEarlyWarning.status === 200 && locationEarlyWarning.json?.success,
    'Set early warning failed',
    locationEarlyWarning
  );

  const locationFamilyBackup = await request(
    'POST',
    `/api/location-reminders/${locationReminderId}/family-backup`,
    { token: tokenA, body: {} }
  );
  assertOk(
    locationFamilyBackup.status === 200 && locationFamilyBackup.json?.success,
    'Set family backup failed',
    locationFamilyBackup
  );

  const locationDelete = await request('DELETE', `/api/location-reminders/${locationReminderId}`, {
    token: tokenA,
  });
  assertOk(
    locationDelete.status === 200 && locationDelete.json?.success,
    'Delete location reminder failed',
    locationDelete
  );

  logStep('Family request + accept flow');
  const familyRequest = await request('POST', '/api/family/request', {
    token: tokenA,
    body: { email: userB.email },
  });
  assertOk(
    familyRequest.status === 200 && familyRequest.json?.success,
    'Send family request failed',
    familyRequest
  );
  const familyRequestId = familyRequest.json.data?._id;
  assertOk(!!familyRequestId, 'Family request id missing', familyRequest);

  const familyRequestsForB = await request('GET', '/api/family/requests', { token: tokenB });
  assertOk(
    familyRequestsForB.status === 200 && familyRequestsForB.json?.success,
    'Get family requests for B failed',
    familyRequestsForB
  );
  assertOk(
    (familyRequestsForB.json?.data || []).some((r) => r.request_id === familyRequestId),
    'Family request not visible to user B',
    familyRequestsForB
  );

  const familyRespond = await request('POST', '/api/family/respond', {
    token: tokenB,
    body: { request_id: familyRequestId, action: 'accept' },
  });
  assertOk(
    familyRespond.status === 200 && familyRespond.json?.success,
    'Accept family request failed',
    familyRespond
  );

  const familyMembersA = await request('GET', '/api/family/members', { token: tokenA });
  assertOk(
    familyMembersA.status === 200 && familyMembersA.json?.success,
    'Get family members for A failed',
    familyMembersA
  );
  assertOk(
    (familyMembersA.json?.data || []).some((m) => m.email === userB.email && m.status === 'connected'),
    'User B not found as connected family member for A',
    familyMembersA
  );

  logStep('Chat flow');
  const privateChat = await request('GET', `/api/chat/private/start?member_id=${userBId}`, {
    token: tokenA,
  });
  assertOk(
    privateChat.status === 200 && privateChat.json?.success,
    'Start private chat failed',
    privateChat
  );
  const chatId = privateChat.json.data?.chat_id;
  assertOk(!!chatId, 'chat_id missing in private chat response', privateChat);

  const sendMessage = await request('POST', '/api/chat/send', {
    token: tokenA,
    body: { chat_id: chatId, content: 'E2E hello from user A' },
  });
  assertOk(sendMessage.status === 200 && sendMessage.json?.success, 'Send chat message failed', sendMessage);

  const getMessages = await request('GET', `/api/chat/messages?chat_id=${chatId}`, {
    token: tokenB,
  });
  assertOk(getMessages.status === 200 && getMessages.json?.success, 'Get chat messages failed', getMessages);
  assertOk(
    (getMessages.json?.data || []).some((m) => m.content === 'E2E hello from user A'),
    'Sent chat message not found',
    getMessages
  );

  logStep('AI chat proxy');
  const sessionId = `e2e_session_${ts}`;
  const aiChat = await request('POST', '/api/ai/chat', {
    token: tokenA,
    body: { message: 'Reply with one short hello sentence.', session_id: sessionId },
  });
  assertOk(aiChat.status === 200, 'AI chat endpoint failed', aiChat);
  assertOk(!(aiChat.json && aiChat.json.success === false), 'AI chat returned success=false', aiChat);

  const aiHistory = await request('GET', `/api/ai/chat/history/${sessionId}`, {
    token: tokenA,
  });
  assertOk(aiHistory.status === 200, 'AI chat history endpoint failed', aiHistory);

  logStep('Conversations endpoint');
  const conversations = await request('GET', '/api/conversations?limit=10', { token: tokenA });
  assertOk(
    conversations.status === 200 && conversations.json?.success,
    'Conversations listing failed',
    conversations
  );

  console.log('\n[E2E] PASS: full API end-to-end flow completed successfully');
  console.log(
    JSON.stringify(
      {
        pass: true,
        users: { userA: userA.email, userB: userB.email },
        ids: { userAId, userBId, sessionId },
      },
      null,
      2
    )
  );
}

main().catch((err) => {
  console.error('\n[E2E] FAIL:', err.message);
  if (err.details) {
    console.error(JSON.stringify(err.details, null, 2));
  }
  process.exit(1);
});
