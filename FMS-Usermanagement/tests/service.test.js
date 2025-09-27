const request = require('supertest');

const baseURL = process.env.BASE_URL;
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'; // ignore self-signed certs

async function loginSuperAdmin() {
  const res = await request(baseURL)
    .post('/api/users/auth/login')
    .set('Content-Type', 'application/x-www-form-urlencoded')
    .send('username=admin@example.com&password=secret'); // adjust credsc

  expect(res.status).toBe(200);
  return res.headers['set-cookie'];
}

describe('Service Accounts API', () => {
  let authCookie; // optional, if your endpoint requires admin auth

  beforeAll(async () => {
    authCookie = await loginSuperAdmin();;
  });

  test('SVC-TOKEN-001: Generate service token (success)', async () => {
    const res = await request(baseURL)
      .post('/api/service-accounts/token')
      .set('Cookie', authCookie) // if required
      .set('Accept', 'application/json');

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('access_token');
    expect(res.body).toHaveProperty('token_type', 'bearer');
  });

  test('SVC-TOKEN-002: Idempotent call (new token each time)', async () => {
    
    const res1 = await request(baseURL)
      .post('/api/service-accounts/token')
      .set('Cookie', authCookie)
      .set('Accept', 'application/json');
    
    const res2 = await request(baseURL)
      .post('/api/users/service-accounts/token')
      .set('Cookie', authCookie)
      .set('Accept', 'application/json');

    expect(res1.status).toBe(200);
    expect(res2.status).toBe(200);

    expect(res1.body).toHaveProperty('access_token');
    expect(res2.body).toHaveProperty('access_token');

    // Ensure a new token is minted each time
    expect(res1.body.access_token).not.toBe(res2.body.access_token);
  });
});
