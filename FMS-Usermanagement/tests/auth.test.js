const request = require('supertest');

const baseURL = process.env.BASE_URL;
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'; // ignore self-signed certs

// 🔹 Utility: login as super admin
async function loginSuperAdmin() {
  const res = await request(baseURL)
    .post('/api/users/auth/login')
    .set('Content-Type', 'application/x-www-form-urlencoded')
    .send('username=admin@example.com&password=secret'); // adjust creds

  expect(res.status).toBe(200);
  return res.headers['set-cookie'];
}

describe('User Auth API', () => {
  beforeAll(async () => {
    adminCookie = await loginSuperAdmin();
  });

/* -----------------------------
      AUTH LOGIN API TESTS
----------------------------- */
describe('Auth Login API', () => {
  let authUser;
  let deletedUser;

  beforeAll(async () => {  

    // --- Create valid user ---
    const res1 = await request(baseURL)
      .post('/api/users/auth/register')
      .send({
        email: `testuser_${Date.now()}@example.com`,
        password: 'TempPass123!',
        role: 'SUPERVISOR',
        customer_name: 'TestUser',
      });
    expect(res1.status).toBe(201);
    authUser = { ...res1.body, password: 'TempPass123!' };

    // --- Create user to delete ---
    const res2 = await request(baseURL)
      .post('/api/users/auth/register')
      .send({
        email: `deleteduser_${Date.now()}@example.com`,
        password: 'DeletedPass123!',
        role: 'SUPERVISOR',
        customer_name: 'DeleteMe',
      });
    expect(res2.status).toBe(201);
    deletedUser = { ...res2.body, password: 'DeletedPass123!' };

    // --- Delete the user via API ---
    const delRes = await request(baseURL)
      .delete(`/api/users/${deletedUser.id}`)
      .set("Cookie", adminCookie);
    expect(delRes.status).toBe(204);
  });

  test('AUTH-LOGIN-001: Login success with valid user & password', async () => {
    const res = await request(baseURL)
      .post('/api/users/auth/login')
      //.set("Cookie", adminCookie)
      .set("Accept", "application/json")
      .type('form')
      .send({ username: authUser.email, password: authUser.password });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('id', authUser.id);
    expect(res.headers['set-cookie']).toEqual(
      expect.arrayContaining([
        expect.stringContaining('jwt'),
        expect.stringContaining('refresh'),
      ])
    );
  });

  test('AUTH-LOGIN-002: Wrong password', async () => {
    const res = await request(baseURL)
      .post('/api/users/auth/login')
      //.set("Cookie", adminCookie)
      .set("Accept", "application/json")
      .type('form')
      .send({ username: authUser.email, password: 'wrongPassword' });

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ detail: 'Invalid credentials' });
  });

  test('AUTH-LOGIN-003: Unknown user', async () => {
    const res = await request(baseURL)
      .post('/api/users/auth/login')
      //.set("Cookie", adminCookie)
      .set("Accept", "application/json")
      .type('form')
      .send({ username: 'unknown@example.com', password: 'anyPassword' });

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ detail: 'Invalid credentials' });
  });

  test('AUTH-LOGIN-004: Deleted user', async () => {
    const res = await request(baseURL)
      .post('/api/users/auth/login')
      //.set("Cookie", adminCookie)
      .set("Accept", "application/json")
      .type('form')
      .send({ username: deletedUser.email, password: deletedUser.password });

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ detail: 'Invalid credentials' });
  });

  test('AUTH-LOGIN-005: Missing field: username', async () => {
    const res = await request(baseURL)
      .post('/api/users/auth/login')
      //.set("Cookie", adminCookie)
      .set("Accept", "application/json")
      .type('form')
      .send({ password: authUser.password });

    expect(res.status).toBe(422);
    expect(Array.isArray(res.body.detail)).toBe(true);
  });

  test('AUTH-LOGIN-006: Missing field: password', async () => {
    const res = await request(baseURL)
      .post('/api/users/auth/login')
      //.set("Cookie", adminCookie)
      .set("Accept", "application/json")
      .type('form')
      .send({ username: authUser.email });

    expect(res.status).toBe(422);
    expect(Array.isArray(res.body.detail)).toBe(true);
  });
});

/* -----------------------------
      AUTH REFRESH API TESTS
----------------------------- */
describe('Auth Refresh API', () => {
  let authUser;
  let authCookie;
  let refreshCookie;
  let adminCookie;

  beforeAll(async () => {
    adminCookie = await loginSuperAdmin();

    // --- Create a new test user ---
    const res1 = await request(baseURL)
      .post('/api/users/auth/register')
      .send({
        email: `refreshtest_${Date.now()}@example.com`,
        password: 'TempPass123!',
        role: 'SUPERVISOR',
        customer_name: 'RefreshTester',
      });
    expect(res1.status).toBe(201);
    authUser = { ...res1.body, password: 'TempPass123!' };

    // --- Login user to get refresh token ---
    const res2 = await request(baseURL)
      .post('/api/users/auth/login')
      .set("Cookie", adminCookie)
      .set('Accept', 'application/json')
      .type('form')
      .send({ username: authUser.email, password: authUser.password });

    expect(res2.status).toBe(200);
    authCookie = res2.headers['set-cookie'];
    refreshCookie = authCookie.find(c => c.includes('refresh'));
    expect(refreshCookie).toBeDefined();
  });

  test('AUTH-REFRESH-001: Refresh success with valid refresh cookie', async () => {
    const res = await request(baseURL)
      .post('/api/users/auth/refresh')
      .set("Cookie", authCookie);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('access_token');
    expect(res.headers['set-cookie']).toEqual(
      expect.arrayContaining([
        expect.stringContaining('jwt'),
        expect.stringContaining('refresh'),
      ])
    );
  });

  test('AUTH-REFRESH-002: Missing refresh token', async () => {
    const res = await request(baseURL)
      .post('/api/users/auth/refresh');

    expect(res.status).toBe(401);
  });

  test('AUTH-REFRESH-003: Invalid/expired refresh token', async () => {
    const fakeCookie = 'refresh=fake.invalid.token';
    const res = await request(baseURL)
      .post('/api/users/auth/refresh')
      .set('Cookie', fakeCookie);

    expect(res.status).toBe(401);
  });

  test('AUTH-REFRESH-004: User not found for refresh token', async () => {
    // --- Delete user ---
    const delRes = await request(baseURL)
      .delete(`/api/users/${authUser.id}`)
      .set("Cookie", adminCookie);
    expect(delRes.status).toBe(204);

    const res = await request(baseURL)
      .post('/api/users/auth/refresh')
      .set('Cookie', authCookie);

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ detail: 'Session expired or invalid' });
  });
});

/* -----------------------------
      AUTH LOGOUT API TESTS
----------------------------- */
describe('Auth Logout API', () => {
  let authUser;
  let authCookie;
  let adminCookie;

  beforeAll(async () => {
    adminCookie = await loginSuperAdmin();

    // --- Create a user for logout tests ---
    const res1 = await request(baseURL)
      .post('/api/users/auth/register')
      .send({
        email: `logouttest_${Date.now()}@example.com`,
        password: 'TempPass123!',
        role: 'SUPERVISOR',
        customer_name: 'LogoutTester',
      });
    expect(res1.status).toBe(201);
    authUser = { ...res1.body, password: 'TempPass123!' };

    // --- Login to get cookies ---
    const res2 = await request(baseURL)
      .post('/api/users/auth/login')
      .set("Cookie", adminCookie)
      .set('Accept', 'application/json')
      .type('form')
      .send({ username: authUser.email, password: authUser.password });

    expect(res2.status).toBe(200);
    authCookie = res2.headers['set-cookie'];
    expect(authCookie).toBeDefined();
  });

  test('AUTH-LOGOUT-001: Logout success with valid session cookie', async () => {
    const res = await request(baseURL)
      .post('/api/users/auth/logout')
      .set('Cookie', authCookie);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ message: 'Logout successful' });

    const cookies = res.headers['set-cookie'] || [];
    expect(cookies.some(c => c.includes('jwt=') && c.toLowerCase().includes('expires'))).toBe(true);
    expect(cookies.some(c => c.includes('refresh_token=') && c.toLowerCase().includes('expires'))).toBe(true);
  });

  test('AUTH-LOGOUT-002: Logout without cookie still returns success', async () => {
    const res = await request(baseURL)
      .post('/api/users/auth/logout');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ message: 'Logout successful' });

    const cookies = res.headers['set-cookie'] || [];
    expect(cookies.some(c => c.includes('jwt=') && c.toLowerCase().includes('expires'))).toBe(true);
    expect(cookies.some(c => c.includes('refresh_token=') && c.toLowerCase().includes('expires'))).toBe(true);
  });
});
});
