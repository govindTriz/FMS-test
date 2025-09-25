const request = require('supertest');
const XLSX = require('xlsx');
const path = require('path');
jest.setTimeout(30000);
const baseURL = 'https://192.168.1.220:8443';
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'; // ignore self-signed certs

let authCookie;
let testCustomer;

// 🔹 Utility: login as super admin
async function loginSuperAdmin() {
  const res = await request(baseURL)
    .post('/api/users/auth/login')
    .set('Content-Type', 'application/x-www-form-urlencoded')
    .send('username=admin@example.com&password=secret'); // adjust creds

  expect(res.status).toBe(200);
  return res.headers['set-cookie'];
}

describe('Customers API', () => {
  beforeAll(async () => {
    authCookie = await loginSuperAdmin();
  });

  // -------------------------------------------------------------------------
  // POST Customers (Excel-driven)
  // -------------------------------------------------------------------------
  describe('POST /api/customers', () => {
    const workbookPost = XLSX.readFile(path.join(__dirname, '../testData/customers_test_data.xlsx'));
    const sheetNamePost = workbookPost.SheetNames[0];
    const testDataPost = XLSX.utils.sheet_to_json(workbookPost.Sheets[sheetNamePost]);

    testDataPost.forEach(test => {
      it(`${test.TestID}: ${test.Scenario || 'Create customer'}`, async () => {
        if (test.special_case === 'race') {
          // 🔹 Race condition test
          const req1 = request(baseURL)
            .post('/api/customers')
            .set('Cookie', authCookie)
            .set('Accept', 'application/json')
            .field('customer_name', test.customer_name + " 1")
            .field('contact_email', test.contact_email)
            .field('password', test.password);

          const req2 = request(baseURL)
            .post('/api/customers')
            .set('Cookie', authCookie)
            .set('Accept', 'application/json')
            .field('customer_name', test.customer_name + " 2")
            .field('contact_email', test.contact_email)
            .field('password', test.password);

          const [res1, res2] = await Promise.all([req1, req2]);
          const statuses = [res1.status, res2.status].sort();
          expect(statuses).toEqual([200, 400]);

          const failedRes = res1.status === 400 ? res1 : res2;
          expect(failedRes.body.detail).toMatch(/already exists/i);
        } else {
          const req = request(baseURL)
            .post('/api/customers')
            .set('Cookie', authCookie)
            .set('Accept', 'application/json');

          if (test.customer_name) req.field('customer_name', test.customer_name);
          if (test.contact_email) req.field('contact_email', test.contact_email);
          if (test.password) req.field('password', test.password);
          if (test.company_name) req.field('company_name', test.company_name);
          if (test.address) req.field('address', test.address);
          if (test.phone_number) req.field('phone_number', test.phone_number);
          if (test.theme_color) req.field('theme_color', test.theme_color);
          if (test.customer_id) req.field('customer_id', `${test.customer_id}-${Date.now()}`); // ensure uniqueness

          if (test.logo) {
            const logoPath = path.join(__dirname, '../testData/logos', 'x.png');
            if (test.logo === '../../x.png') {
              req.attach('logo', logoPath, '../../x.png');
            } else {
              req.attach('logo', path.join(__dirname, '../testData/logos', test.logo));
            }
          }

          const res = await req;
          expect(res.status).toBe(test.expected_status);

          if (test.expected_detail_or_message) {
            expect(JSON.stringify(res.body).toLowerCase()).toContain(
              test.expected_detail_or_message.toLowerCase()
            );
          }
        }
      });
    });
  });

  // -------------------------------------------------------------------------
  // GET Customers
  // -------------------------------------------------------------------------
  describe('GET /api/customers', () => {
    it('CUST-GET-001: List customers', async () => {
      const res = await request(baseURL)
        .get('/api/customers')
        .set('Cookie', authCookie);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.every(c => c.is_deleted !== true)).toBe(true);
    });

    it('CUST-GET-002: Empty list when DB empty (conditional)', async () => {
      const res = await request(baseURL)
        .get('/api/customers')
        .set('Cookie', authCookie);

      if (res.body.length === 0) {
        expect(res.status).toBe(200);
        expect(res.body).toEqual([]);
      } else {
        console.warn('⚠️ DB not empty, skipping empty case');
      }
    });

    it('CUST-GET-003: Trailing slash alias', async () => {
      const res = await request(baseURL)
        .get('/api/customers/')
        .set('Cookie', authCookie);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('CUST-GET-004: Ignore unknown query params', async () => {
      const res = await request(baseURL)
        .get('/api/customers?foo=bar')
        .set('Cookie', authCookie);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('CUST-GET-005: Response shape integrity', async () => {
      const res = await request(baseURL)
        .get('/api/customers')
        .set('Cookie', authCookie)
        .set('Accept', 'application/json');

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);

      res.body.forEach(customer => {
        expect(customer).toHaveProperty('id');
        expect(customer).toHaveProperty('customer_id');
        expect(customer).toHaveProperty('customer_name');
        expect(customer).toHaveProperty('contact_email');
        expect(customer).toHaveProperty('created_at');

        if ('updated_at' in customer && customer.updated_at !== null) {
          expect(typeof customer.updated_at).toBe('string');
        }

        ['company_name', 'address', 'phone_number', 'theme_color', 'logo'].forEach(field => {
          if (customer[field] !== undefined) {
            expect(
              customer[field] === null || customer[field] === '' || typeof customer[field] === 'string'
            ).toBe(true);
          }
        });
      });
    });

    it('CUST-DATA-001: created_at/updated_at are strings', async () => {
        const res = await request(baseURL)
            .get('/api/customers')
            .set('Cookie', authCookie);

        expect(res.status).toBe(200);
        
        res.body.forEach(c => {
            expect(typeof c.created_at).toBe('string');
            expect(isNaN(Date.parse(c.created_at))).toBe(false);

            // updated_at is optional, but if present it must be a string
            if (c.updated_at !== undefined && c.updated_at !== null) {
            expect(typeof c.updated_at).toBe('string');
            expect(isNaN(Date.parse(c.updated_at))).toBe(false);
            }
        });
    });

    it('CUST-DATA-002: id resolution fallback', async () => {
        const res = await request(baseURL)
            .get('/api/customers')
            .set('Cookie', authCookie);

        expect(res.status).toBe(200);

        res.body.forEach(c => {
            expect(c.id).toBeDefined();
            // It must equal one of the two possible IDs
            expect([c.customer_id, String(c._id)].includes(c.id)).toBe(true);
        });
    });


    it('CUST-SEC-001: No sensitive leakage', async () => {
        const res = await request(baseURL)
            .get('/api/customers')
            .set('Cookie', authCookie);

        expect(res.status).toBe(200);
        res.body.forEach(c => {
            expect(c).not.toHaveProperty('password');
            expect(c).not.toHaveProperty('password_hash');
            expect(c).not.toHaveProperty('salt');
      });
    });

});

  // -------------------------------------------------------------------------
  // PATCH Customers (Excel-driven)
  // -------------------------------------------------------------------------
  describe('PATCH /api/customers/{id}', () => {
    const workbookPatch = XLSX.readFile(path.join(__dirname, '../testData/customers_patch_test_data.xlsx'));
    const sheetNamePatch = workbookPatch.SheetNames[0];
    const testDataPatch = XLSX.utils.sheet_to_json(workbookPatch.Sheets[sheetNamePatch]);

    beforeAll(async () => {
      // Create a fresh test customer to patch
        const customerRes1 = await request(baseURL)
          .post('/api/customers')
          .set('Cookie', authCookie)
          .field('customer_name', 'Patch Test Customer')
          .field('contact_email', `patch_test_${Date.now()}@example.com`)
          .field('customer_id', 'PAT-001')
          .field('password', 'secret123');
      
        expect(customerRes1.status).toBe(200);
      
       // Creating a second customer for CUST-PATCH-007
        const customerRes2 = await request(baseURL)
          .post('/api/customers')
          .set('Cookie', authCookie)
          .field('customer_name', 'Patch Test Customer')
          .field('contact_email', 'patch_test_customer@example.com')
          .field('customer_id', 'PAT-002')
          .field('password', 'secret123');
      
        expect(customerRes2.status).toBe(200);
        testCustomer = customerRes1.body; // contains customer_id, etc.
      
        // Creating a new user for CUST-PATCH-008
        const newUser = {
              email: "patch_test_user@example.com",
              password: "TempPass123!",
              role: "SUPERVISOR",
              customer_name: "TempTest",
              customer_id: "PAT-003"
              };
      
              
        const createRes = await request(baseURL)
              .post('/api/auth/register')
              .set('Cookie', authCookie)
              .set('Accept', 'application/json')
              .send(newUser);
      });

    testDataPatch.forEach(test => {
      it(`${test.TestID}: ${test.Scenario}`, async () => {
        const req = request(baseURL)
          .patch(`/api/customers/${test.customer_id || testCustomer.customer_id}`)
          .set('Cookie', authCookie)
          .set('Accept', 'application/json');

        Object.keys(test).forEach(key => {
          if (['TestID', 'Scenario', 'expected_status', 'expected_detail_or_message'].includes(key)) return;
          if (test[key]) req.field(key, test[key]);
        });

        if (test.logo) {
          req.attach('logo', path.join(__dirname, '../testData/logos', test.logo));
        }

        const res = await req;
        expect(res.status).toBe(test.expected_status);

        if (test.expected_detail_or_message) {
          expect(JSON.stringify(res.body).toLowerCase()).toContain(
            test.expected_detail_or_message.toLowerCase()
          );
        }
      });
    });
    
    it("CUST-PATCH-009: Update with unknown fields (ignored)", async () => {
        const res = await request(baseURL)
            .patch(`/api/customers/${testCustomer.customer_id}`)
            .set("Cookie", authCookie)
            .field("foo", "bar") // unknown field
            .field("customer_name", "Updated Customer With Foo"); // valid field so we can detect update

        expect(res.status).toBe(200);

        // Valid field should update
        expect(res.body.customer_name).toBe("Updated Customer With Foo");

        // Unknown field should be ignored
        expect(res.body.foo).toBeUndefined();
        });
  });

  // -------------------------------------------------------------------------
  // DELETE Customers
  // -------------------------------------------------------------------------
  describe('DELETE /api/customers/{id}', () => {
    let deleteTarget;

    beforeAll(async () => {
      const res = await request(baseURL)
        .post('/api/customers')
        .set('Cookie', authCookie)
        .field('customer_name', 'Delete Test Customer')
        .field('contact_email', `delete_test_${Date.now()}@example.com`)
        .field('customer_id', `del-${Date.now()}`)
        .field('password', 'secret123');

      expect(res.status).toBe(200);
      deleteTarget = res.body;
    });

    it('CUST-DEL-001: Delete existing customer (soft)', async () => {
      const res = await request(baseURL)
        .delete(`/api/customers/${deleteTarget.customer_id}`)
        .set('Cookie', authCookie);

      expect(res.status).toBe(204);
    });

    it('CUST-DEL-002: Delete non-existent customer', async () => {
      const randomId = 'nonexist-' + Date.now();
      const res = await request(baseURL)
        .delete(`/api/customers/${randomId}`)
        .set('Cookie', authCookie);

      expect(res.status).toBe(404);
      expect(res.body.detail).toMatch(/not found/i);
    });

    it('CUST-DEL-003: Double delete idempotency', async () => {
      const res = await request(baseURL)
        .delete(`/api/customers/${deleteTarget.customer_id}`)
        .set('Cookie', authCookie);

      expect(res.status).toBe(404);
      expect(res.body.detail).toMatch(/not found/i);
    });
  });
});
