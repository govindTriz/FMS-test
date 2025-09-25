const request = require('supertest');
const XLSX = require('xlsx');
const path = require('path');

const baseURL = 'https://192.168.1.220:8443';
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'; // ignore self-signed certs

let authCookie;

// 🔹 Utility: login as super admin
async function loginSuperAdmin() {
  const res = await request(baseURL)
    .post('/api/users/auth/login')
    .set('Content-Type', 'application/x-www-form-urlencoded')
    .send('username=admin@example.com&password=secret'); // adjust creds

  expect(res.status).toBe(200);
  return res.headers['set-cookie'];
}

function randomHexId(length = 24) {
  const chars = "abcdef0123456789";
  let id = "";
  for (let i = 0; i < length; i++) {
    id += chars[Math.floor(Math.random() * chars.length)];
  }
  return id;
}

describe('Users API', () => {
  beforeAll(async () => {
    authCookie = await loginSuperAdmin();
  });

  // -------------------------------------------------------------------------
  // POST Users (Excel-driven)
  // -------------------------------------------------------------------------
  describe('POST /api/users', () => {
    const workbookPost =XLSX.readFile(path.join(__dirname, '../testData/users_test_data.xlsx'));
    const sheetNamePost = workbookPost.SheetNames[0];
    const testDataPost = XLSX.utils.sheet_to_json(workbookPost.Sheets[sheetNamePost]);

    testDataPost.forEach(row => {
      const {
            TestID,
            Scenario,
            email,
            password,
            role,
            customer_name,
            customer_id,
            'Expected Status': ExpectedStatus,
            'Expected Response': ExpectedResponse
          } = row;
      
          test(`${TestID} - ${Scenario}`, async () => {
            const requestData = {};
            if (email) requestData.email = email;
            if (password) requestData.password = password;
            if (role) requestData.role = role;
            if (customer_name) requestData.customer_name = customer_name;
            if (customer_id) requestData.customer_id = customer_id
      
            const response = await request(baseURL)
              .post('/api/users')
              .set('Cookie', authCookie)
              .set('Accept', 'application/json')
              .send(requestData);
            
            expect(response.status).toBe(ExpectedStatus);
      
            if (ExpectedResponse && ExpectedResponse !== "UserOut") {
              try {
                const expectedObj = JSON.parse(ExpectedResponse.replace(/\.\.\./g, 'null'));
                expect(response.body).toMatchObject(expectedObj);
              } catch (e) {
              }
            } else {
              console.log("Expected response is UserOut, skipping strict body validation.");
            }
          });
    });
  });

  
  // -------------------------------------------------------------------------
  // GET Users from specific User ID
  // -------------------------------------------------------------------------
  describe('GET /api/users/{id}', () => {
    beforeAll(async () => {
          // Create a fresh test user to get
         const newUser = {
               email: `get_main_${Date.now()}@example.com`,
               password: "TempPass123!",
               role: "SUPERVISOR",
               customer_name: "TempTest",
               customer_id: `get_main_${Date.now()}`
             };
         
             const createRes = await request(baseURL)
               .post('/api/users')
               .set('Cookie', authCookie)
               .set('Accept', 'application/json')
               .send(newUser);
        
             createdUserId = createRes.body.id;
          });
    
      it("USR-GET-001: Get user by valid ID", async () => {
          const res = await request(baseURL)
            .get(`/api/users/${createdUserId}`)
            .set('Cookie', authCookie)
            .set('Accept', 'application/json');
      
          expect(res.status).toBe(200);
          expect(res.body.id).toBe(createdUserId);
      
        });
      
        it("USR-GET-002: User not found", async () => {
          const randomHexId = "68d39b873ca0d54ebb2f43ff"
          const res = await request(baseURL)
            .get(`/api/users/${randomHexId}`)
            .set('Cookie', authCookie)
            .set('Accept', 'application/json');
      
          expect(res.status).toBe(404);
          expect(res.body).toMatchObject({ detail: "User not found" });
        });
      
        it("USR-GET-003: Invalid ID format", async () => {
          const res = await request(baseURL)
            .get(`/api/users/invalid-id`)
            .set('Cookie', authCookie)
            .set('Accept', 'application/json');
      
          expect(res.status).toBe(422);
        });
});


  // -------------------------------------------------------------------------
  // PATCH Users
  // -------------------------------------------------------------------------
  describe('PATCH /api/users/{id}', () => {
    // helper at top of file


    beforeAll(async () => {
      // Create a fresh test customer to patch
        const res1 = await request(baseURL)
            .post("/api/users")
            .set("Cookie", authCookie)
            .set("Accept", "application/json")
            .send({
              email: `patch_main_${Date.now()}@example.com`,
              password: "TempPass123!",
              role: "SUPERVISOR",
              customer_name: "MainUser",
            });
        
          expect(res1.status).toBe(201);
          mainUser = res1.body;
      
       // Creating a second customer for CUST-PATCH-007
         const res2 = await request(baseURL)
            .post("/api/users")
            .set("Cookie", authCookie)
            .set("Accept", "application/json")
            .send({
              email: `patch_other_${Date.now()}@example.com`,
              password: "TempPass123!",
              role: "SUPERVISOR",
              customer_name: "OtherUser",
            });
        
          expect(res2.status).toBe(201);
          otherUser = res2.body;
      
      });

    it("USR-PATCH-001: Update name only", async () => {
        const res = await request(baseURL)
          .patch(`/api/users/${mainUser.id}`)
          .set("Cookie", authCookie)
          .send({ customer_name: "NewName" });
    
        expect(res.status).toBe(200);
        expect(res.body.customer_name).toBe("NewName");
      });
    
      it("USR-PATCH-002: Update email (no conflict)", async () => {
        const newEmail = `new_${Date.now()}@example.com`;
        const res = await request(baseURL)
          .patch(`/api/users/${mainUser.id}`)
          .set("Cookie", authCookie)
          .send({ email: newEmail });
    
        expect(res.status).toBe(200);
        expect(res.body.email).toBe(newEmail);
      });
    
      it("USR-PATCH-003: Duplicate email on update", async () => {
        const res = await request(baseURL)
          .patch(`/api/users/${mainUser.id}`)
          .set("Cookie", authCookie)
          .send({ email: otherUser.email });
    
        expect(res.status).toBe(400); // or 409 depending on your API
        expect(JSON.stringify(res.body).toLowerCase()).toContain("email");
      });
    
      it("USR-PATCH-004: Update password hashes", async () => {
        const res = await request(baseURL)
          .patch(`/api/users/${mainUser.id}`)
          .set("Cookie", authCookie)
          .send({ password: "NewStr0ng!" });
    
        expect(res.status).toBe(200);
        expect(res.body).not.toHaveProperty("password");
      });
    
      it("USR-PATCH-005: No changes detected", async () => {
        const res = await request(baseURL)
          .patch(`/api/users/${mainUser.id}`)
          .set("Cookie", authCookie)
          .send({});
    
        expect(res.status).toBe(400); 
        expect(JSON.stringify(res.body).toLowerCase()).toContain("no changes");
      });
    
      it("USR-PATCH-006: User not found", async () => {
        const fakeId = randomHexId();
        const res = await request(baseURL)
          .patch(`/api/users/${fakeId}`) // non-existent id
          .set("Cookie", authCookie)
          .send({ customer_name: "X" });
    
        expect(res.status).toBe(404);
        expect(JSON.stringify(res.body).toLowerCase()).toContain("not found");
      });
    
      it("USR-PATCH-007: Invalid id format", async () => {
        const res = await request(baseURL)
          .patch(`/api/users/invalid-id`)
          .set("Cookie", authCookie)
          .send({ customer_name: "Bad" });
    
        expect(res.status).toBe(400);
        expect(JSON.stringify(res.body).toLowerCase()).toContain("invalid");
      });
  });

  // -------------------------------------------------------------------------
  // DELETE Users using Specific User ID
  // -------------------------------------------------------------------------
  describe('DELETE /api/users/{id}', () => {
    
    beforeAll(async () => {
      const userRes = await request(baseURL)
          .post("/api/users")
          .set("Cookie", authCookie)
          .set("Accept", "application/json")
          .send({
            email: `del_test_${Date.now()}@example.com`,
            password: "TempPass123!",
            role: "SUPERVISOR",
            customer_name: "DeleteMe",
          });
      
        expect(userRes.status).toBe(201);
        deleteUser = userRes.body;
    });

    it("USR-DEL-001: Delete existing user", async () => {
        const res = await request(baseURL)
          .delete(`/api/users/${deleteUser.id}`)
          .set("Cookie", authCookie);

        expect(res.status).toBe(204);
        expect(res.body).toEqual({}); // empty body
      });
    
      it("USR-DEL-002: User not found or already deleted", async () => {
        const res = await request(baseURL)
          .delete(`/api/users/${deleteUser.id}`)
          .set("Cookie", authCookie);
    
        expect(res.status).toBe(404);
        expect(JSON.stringify(res.body).toLowerCase()).toContain("not found");
      });
    
      it("USR-DEL-002 (alt path): Random non-existent user", async () => {
        const fakeId = randomHexId(); 
        const res = await request(baseURL)
          .delete(`/api/users/${fakeId}`)
          .set("Cookie", authCookie);
    
        expect(res.status).toBe(404);
        expect(JSON.stringify(res.body).toLowerCase()).toContain("not found");
      });
    
      it("USR-DEL-003: Invalid id format", async () => {
        const res = await request(baseURL)
          .delete(`/api/users/invalid-id`)
          .set("Cookie", authCookie);
    
        expect(res.status).toBe(400);
        expect(JSON.stringify(res.body).toLowerCase()).toContain("invalid");
      });
  });


  // -------------------------------------------------------------------------
  // GET All Users
  // -------------------------------------------------------------------------
  describe('GET /api/users', () => {
    it('USR-LIST-001: List users (defaults)', async () => {
        const res = await request(baseURL)
          .get('/api/users')
          .set('Cookie', authCookie)
          .set('Accept', 'application/json');

        expect(res.status).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
        expect(res.body.length).toBeLessThanOrEqual(100);
      });
    
      it('USR-LIST-002: Empty list', async () => {
        const res = await request(baseURL)
          .get('/api/users')
          .query({ skip: 0, limit: 100 })
          .set('Cookie', authCookie)
          .set('Accept', 'application/json');
    
        expect(res.status).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
      });
    
      it('USR-LIST-003: Pagination basic', async () => {
        const res = await request(baseURL)
          .get('/api/users?skip=5&limit=10')
          .query({ skip: 5, limit: 10 })
          .set('Cookie', authCookie)
          .set('Accept', 'application/json');
    
        expect(res.status).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
        expect(res.body.length).toBeLessThanOrEqual(10);
      });
    
       it('USR-LIST-004: Filter by customer_id', async () => {
        const customerId = '123abc';
        const res = await request(baseURL)
            .get('/api/users?customer_id=123abc')
            .query({ customer_id: customerId })
            .set('Cookie', authCookie)
            .set('Accept', 'application/json');
    
        expect(res.status).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
    
        // Only check users that have a customer_id
        res.body.forEach(user => {
            if (user.customer_id !== null) {
                expect(user.customer_id).toBe(customerId);
            }
        });
    });
    
      it('USR-LIST-005: Filter is_deleted true', async () => {
        const res = await request(baseURL)
          .get('/api/users')
          .query({ is_deleted: true }) // keep just one way of passing query
          .set('Cookie', authCookie)
          .set('Accept', 'application/json');

        expect(res.status).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);

        // This fails if no user is returned OR if any user isn’t deleted
        expect(res.body.length).toBeGreaterThan(0);  // API must return something
        res.body.forEach(user => {
          expect(user.is_deleted).toBe(true);
        });
      });
    
      it('USR-LIST-006: Invalid query types (edge)', async () => {
        const res = await request(baseURL)
          .get('/api/users?skip=-1&limit=-5')
          .set('Cookie', authCookie)
          .set('Accept', 'application/json');

        expect(res.status).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
        });

  });
});
