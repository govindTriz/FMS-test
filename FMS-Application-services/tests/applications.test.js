// applications.test.js
const request = require("supertest");
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0"; // allow self-signed certs

const baseURL = "https://192.168.1.220:8443";
const endpoint = "/api/applications/";
const validCustomerId = "f28129bd-e9d9-4c5c-9860-29a7c92bd8a5";

let authCookie;

async function loginSuperAdmin() {
  const res = await request(baseURL)
    .post("/api/users/auth/login")
    .set("Content-Type", "application/x-www-form-urlencoded")
    .send("username=admin@example.com&password=secret"); // adjust creds
  expect(res.status).toBe(200);
  return res.headers["set-cookie"];
}

beforeAll(async () => {
  authCookie = await loginSuperAdmin();
});

// -------------------------------------------------------------------------
// POST Applications
// -------------------------------------------------------------------------
describe("POST /api/applications", () => {
  it("APP-POST-001: Create application (happy path)", async () => {
      const res = await request(baseURL)
        .post(endpoint)
        .set("Cookie", authCookie)
        .send({
          name: "App One",
          description: "demo app created via supertest",
          customer_id: validCustomerId,
          initial_version: "1.0.0",
          app_metadata: { color: "blue" },
        });
  
      expect(res.status).toBe(200); // service returns 200 not 201
      expect(res.body).toMatchObject({
        id: expect.any(String),
        name: "App One",
        customer_id: validCustomerId,
        created_at: expect.any(String),
        updated_at: expect.any(String),
      });
    });
  
    it("APP-POST-002: Missing required application_id", async () => {
      const res = await request(baseURL)
        .post(endpoint)
        .set("Cookie", authCookie)
        .send({
          name: "App Missing ID",
          customer_id: validCustomerId,
          initial_version: "1.0.0",
        });
  
      expect(res.status).toBe(422);
      expect(res.body.detail).toBeDefined();
    });
  
    it("APP-POST-003: Missing required name", async () => {
      const res = await request(baseURL)
        .post(endpoint)
        .set("Cookie", authCookie)
        .send({
          customer_id: validCustomerId,
          initial_version: "1.0.0",
        });
  
      expect(res.status).toBe(422);
      expect(res.body.detail).toBeDefined();
    });
  
    it("APP-POST-004: Invalid customer_id format", async () => {
      const res = await request(baseURL)
        .post(endpoint)
        .set("Cookie", authCookie)
        .send({
          name: "InvalidCust",
          description: "bad uuid",
          customer_id: "not-a-uuid",
          initial_version: "1.0.0",
        });
  
      expect(res.status).toBe(422);
      expect(res.body.detail).toBeDefined();
    });
  
    it("APP-POST-005: Duplicate application_id", async () => {
      const app = {
        name: "Dup Test",
        description: "first insert",
        customer_id: validCustomerId,
        initial_version: "1.0.0",
      };
  
      await request(baseURL).post(endpoint).set("Cookie", authCookie).send(app);
      const res = await request(baseURL).post(endpoint).set("Cookie", authCookie).send(app);
  
      expect([400, 409]).toContain(res.status);
    });
  
    it("APP-POST-006: Extra unknown fields in body", async () => {
      const res = await request(baseURL)
        .post(endpoint)
        .set("Cookie", authCookie)
        .send({
          name: "ExtraApp",
          description: "has extra field",
          customer_id: validCustomerId,
          initial_version: "1.0.0",
          foo: "bar", // unknown
        });
  
      expect([200, 422]).toContain(res.status);
    });
  
    it("APP-POST-007: Duplicate application_id (per customer)", async () => {
      const app = {
        name: "App PerCust",
        description: "original",
        customer_id: validCustomerId,
        initial_version: "1.0.0",
      };
  
      await request(baseURL).post(endpoint).set("Cookie", authCookie).send(app);
      const res = await request(baseURL).post(endpoint).set("Cookie", authCookie).send(app);
  
      expect([400, 409]).toContain(res.status);
    });
  
    it("APP-POST-008: Very long name/notes", async () => {
      const res = await request(baseURL)
        .post(endpoint)
        .set("Cookie", authCookie)
        .send({
          name: "x".repeat(2000),
          description: "very long name field",
          customer_id: validCustomerId,
          initial_version: "1.0.0",
        });
  
      expect([200, 422, 413]).toContain(res.status);
    });
  
    it("APP-POST-009: Unicode / emoji in fields", async () => {
      const res = await request(baseURL)
        .post(endpoint)
        .set("Cookie", authCookie)
        .send({
          application_id: "app-010",
          name: "App 🚀🔥",
          description: "emoji test",
          customer_id: validCustomerId,
          initial_version: "1.0.0",
        });
  
      expect(res.status).toBe(200);
      expect(res.body.name).toContain("🚀");
    });
});

// -------------------------------------------------------------------------
// GET Applications
// -------------------------------------------------------------------------
describe("GET /api/applications", () => {
  let testApp;

 it("APP-LIST-001: List applications (defaults)", async () => {
     const res = await request(baseURL)
       .get(endpoint)
       .set("Cookie", authCookie);
 
     
     expect(res.status).toBe(200);
     expect(Array.isArray(res.body)).toBe(true);
     expect(res.body.length).toBeLessThanOrEqual(100);
   });
 
   it("APP-LIST-002: Empty list when DB has no apps", async () => {
     const res = await request(baseURL)
       .get(endpoint)
       .set("Cookie", authCookie);
 
     expect(res.status).toBe(200);
     expect(res.body).toEqual(expect.any(Array));
   });
 
   it("APP-LIST-003: Pagination (skip=5, limit=10)", async () => {
     const res = await request(baseURL)
       .get(endpoint)
       .query({ skip: 5, limit: 10 })
       .set("Cookie", authCookie);
 
     expect(res.status).toBe(200);
     expect(Array.isArray(res.body)).toBe(true);
     expect(res.body.length).toBeLessThanOrEqual(10);
   });
 
   it("APP-LIST-004: Filter by customer_id", async () => {
     const customerId = "f28129bd-e9d9-4c5c-9860-29a7c92bd8a4"; // adjust
     const res = await request(baseURL)
       .get(endpoint)
       .query({ customer_id: customerId })
       .set("Cookie", authCookie);
 
     expect(res.status).toBe(200);
     expect(res.body.every(app => app.customer_id === customerId)).toBe(true);
   });
 
   it("APP-LIST-005: Invalid customer_id in query", async () => {
     const res = await request(baseURL)
       .get(endpoint)
       .query({ customer_id: "bad-uuid" })
       .set("Cookie", authCookie);
 
     expect(res.status).toBe(422);
     expect(res.body.detail).toBeDefined();
   });
 });
 
 describe("GET /api/applications/:id", () => {

    beforeAll(async () => {
    const appRes = await request(baseURL)
      .post(endpoint)
      .set("Cookie", authCookie)
      .send({
        name: "Test App GET",
        customer_id: validCustomerId,
        initial_version: "1.0.0",
      });
    expect([200, 201]).toContain(appRes.status);
    testApp = appRes.body;
  });

   it("APP-GET-001: Get application (happy path)", async () => {
     const res = await request(baseURL)
       .get(`${endpoint}/${testApp.id}`)
       .set("Cookie", authCookie);
 
     expect(res.status).toBe(200);
     expect(res.body.application_id).toBe(testApp.application_id);
     expect(res.body.name).toBe(testApp.name);
   });
 
   it("APP-GET-002: Application not found", async () => {
     const randomAppId = "079d55da-b0ae-4fe6-8d94-2752f4b71a90"
     const res = await request(baseURL)
       .get(`${endpoint}/${randomAppId}`)
       .set("Cookie", authCookie);
 
     expect(res.status).toBe(404);
     expect(res.body).toEqual({ detail: "Application not found" });
   });
 
  
 });

// -------------------------------------------------------------------------
// PUT Applications
// -------------------------------------------------------------------------
describe("PUT /api/applications/:id", () => {
  let testApp;

  beforeAll(async () => {
    const appRes = await request(baseURL)
      .post(endpoint)
      .set("Cookie", authCookie)
      .send({
        name: "Original App PUT",
        customer_id: validCustomerId,
        initial_version: "1.0.0",
      });
    expect([200, 201]).toContain(appRes.status);
    testApp = appRes.body;
  });

  it("APP-PUT-001: Update application (happy path)", async () => {
    const res = await request(baseURL)
      .put(`${endpoint}/${testApp.id}`)
      .set("Cookie", authCookie)
      .send({ name: "Renamed App" });

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(testApp.id);
    expect(res.body.name).toBe("Renamed App");
  });

  it("APP-PUT-002: Update not found", async () => {
    const res = await request(baseURL)
      .put(`${endpoint}/079d55da-b0ae-4fe6-8d94-2752f4b71a90`)
      .set("Cookie", authCookie)
      .send({ name: "X" });

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ detail: "Application not found" });
  });
});

// -------------------------------------------------------------------------
// DELETE Applications
// -------------------------------------------------------------------------
describe("DELETE /api/applications/:id", () => {
  let testApp;

  beforeAll(async () => {
    const appRes = await request(baseURL)
      .post(endpoint)
      .set("Cookie", authCookie)
      .send({
        name: "Delete Test App",
        customer_id: validCustomerId,
        initial_version: "1.0.0",
      });
    expect([200, 201]).toContain(appRes.status);
    testApp = appRes.body;
  });

  it("APP-DEL-001: Delete application (happy path)", async () => {
    const res = await request(baseURL)
      .delete(`${endpoint}/${testApp.id}`)
      .set("Cookie", authCookie);

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(testApp.id);
  });

  it("APP-DEL-002: Delete not found", async () => {
    const res = await request(baseURL)
      .delete(`${endpoint}/079d55da-b0ae-4fe6-8d94-2752f4b71a90`)
      .set("Cookie", authCookie);

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ detail: "Application not found" });
  });

  it("APP-DEL-003: Double delete (idempotency check)", async () => {
    const res = await request(baseURL)
      .delete(`${endpoint}/${testApp.id}`)
      .set("Cookie", authCookie);

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ detail: "Application not found" });
  });
});
