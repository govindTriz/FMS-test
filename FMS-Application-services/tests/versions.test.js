// versions.test.js
const request = require("supertest");
jest.setTimeout(30000);
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0"; // allow self-signed certs

const baseURL = process.env.BASE_URL;
const applicationsEndpoint = "/api/applications/";
const versionsEndpoint = "/api/versions/application/";
const endpoint = "/api/versions";
const validCustomerId = "f28129bd-e9d9-4c5c-9860-29a7c92bd8a5";

let authCookie;
let testApp;
let testVersion;
let testVersions = [];

async function loginSuperAdmin() {
  const res = await request(baseURL)
    .post("/api/users/auth/login")
    .set("Content-Type", "application/x-www-form-urlencoded")
    .send("username=admin@example.com&password=secret");

  expect(res.status).toBe(200);
  return res.headers["set-cookie"];
}

// -------------------------------------------------------------------------
// Setup for all tests
// -------------------------------------------------------------------------
beforeAll(async () => {
  authCookie = await loginSuperAdmin();

  // Create test app
    const appRes = await request(baseURL)
      .post(applicationsEndpoint)
      .set("Cookie", authCookie)
      .send({
        name: "Version Test App",
        description: "App for version testing",
        customer_id: validCustomerId,
        initial_version: "0.1.0",
      });
  
    expect([200, 201]).toContain(appRes.status);
  
    testApp = appRes.body;
    applicationId = appRes.body.id; // fixed here (was appRes.id)

  // Create initial test version
  const versionRes = await request(baseURL)
    .post(endpoint)
    .set("Cookie", authCookie)
    .send({
      application_id: applicationId,
      version: "10.0.0",
      changelog: "initial",
    });

  expect(versionRes.status).toBe(200);
  testVersion = versionRes.body;

  // Create multiple versions for listing/pagination tests
  for (let i = 1; i <= 15; i++) {
    const vRes = await request(baseURL)
      .post(endpoint)
      .set("Cookie", authCookie)
      .send({
        application_id: applicationId,
        version: `10.0.${i}`,
        changelog: `Change log ${i}`,
      });
    expect(vRes.status).toBe(200);
    testVersions.push(vRes.body);
  }
});

// -------------------------------------------------------------------------
// POST /versions tests
// -------------------------------------------------------------------------
describe("Versions API - POST /versions", () => {
it("VER-POST-001: Create version (happy path)", async () => {
    const payload = {
      application_id: applicationId,
      version: "1.0.0",
      changelog: "init",
    };

    const res = await request(baseURL)
      .post(endpoint)
      .set("Cookie", authCookie)
      .send(payload);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("id");
    expect(res.body.version).toBe("1.0.0");
  });
 
   it("VER-POST-002: Missing required field(s)", async () => {
     const payload = { version: "1.1.0" };
 
     const res = await request(baseURL)
       .post(endpoint)
       .set("Cookie", authCookie)
       .send(payload);
 
     expect(res.status).toBe(422);
     expect(res.body).toHaveProperty("detail");
   });
 
   it("VER-POST-003: Invalid application_id (UUID)", async () => {
     const payload = { application_id: "bad-uuid", version: "1.1.0" };
 
     const res = await request(baseURL)
       .post(endpoint)
       .set("Cookie", authCookie)
       .send(payload);
 
     expect(res.status).toBe(422);
     expect(res.body).toHaveProperty("detail");
   });
 
   it("VER-POST-004: Duplicate version per application", async () => {
     const payload = { application_id: applicationId, version: "1.0.0" };
     await request(baseURL).post(endpoint).set("Cookie", authCookie).send(payload);
 
     const res = await request(baseURL)
       .post(endpoint)
       .set("Cookie", authCookie)
       .send(payload);
 
     expect([400, 409]).toContain(res.status);
   });
 
   it("VER-POST-005: Unknown/extra fields in body", async () => {
     const payload = {
       application_id: applicationId,
       version: "3.0.0",
       foo: "bar",
     };
 
     const res = await request(baseURL)
       .post(endpoint)
       .set("Cookie", authCookie)
       .send(payload);
 
     expect([200, 422]).toContain(res.status);
   });
 
   it("VER-POST-006: Application not found", async () => {
     const payload = {
       application_id: "079d55da-b0ae-4fe6-8d94-2752f4b71a90",
       version: "4.0.0",
     };
 
     const res = await request(baseURL)
       .post(endpoint)
       .set("Cookie", authCookie)
       .send(payload);
 
     expect([400, 404]).toContain(res.status);
   });
 
   it("VER-POST-007: Non-semver version string", async () => {
     const payload = { application_id: applicationId, version: "abc" };
 
     const res = await request(baseURL)
       .post(endpoint)
       .set("Cookie", authCookie)
       .send(payload);
 
     expect([200, 422]).toContain(res.status);
   });
 
   it("VER-POST-008: Trim/case normalization", async () => {
     await request(baseURL)
       .post(endpoint)
       .set("Cookie", authCookie)
       .send({ application_id: applicationId, version: "5.0.0" });
 
     const payload = { application_id: applicationId, version: " 5.0.0 " };
 
     const res = await request(baseURL)
       .post(endpoint)
       .set("Cookie", authCookie)
       .send(payload);
 
     expect([200, 409]).toContain(res.status);
   });
 
   it("VER-POST-009: Large notes payload", async () => {
     const bigNotes = "x".repeat(10000);
     const payload = {
       application_id: applicationId,
       version: "6.0.0",
       changelog: bigNotes,
     };
 
     const res = await request(baseURL)
       .post(endpoint)
       .set("Cookie", authCookie)
       .send(payload);
 
     expect([200, 422, 413]).toContain(res.status);
   });
 
   it("VER-POST-010: Race: duplicate per app", async () => {
     const payload = { application_id: applicationId, version: "7.0.0" };
 
     const [res1, res2] = await Promise.all([
       request(baseURL).post(endpoint).set("Cookie", authCookie).send(payload),
       request(baseURL).post(endpoint).set("Cookie", authCookie).send(payload),
     ]);
 
     expect([200, 409]).toContain(res1.status);
     expect([200, 409]).toContain(res2.status);
   });
});

// -------------------------------------------------------------------------
// GET /versions/{version_id} tests
// -------------------------------------------------------------------------
describe("Versions API - GET /versions/{version_id}", () => {
  it("VER-GET-001: Get version (happy path)", async () => {
      const res = await request(baseURL)
        .get(`${endpoint}/${testVersion.id}`)
        .set("Cookie", authCookie);
  
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("id", testVersion.id);
      expect(res.body).toHaveProperty("version", testVersion.version);
      expect(res.body).toHaveProperty("application_id", testApp.id);
    });
  
    it("VER-GET-002: Version not found", async () => {
      const randomId = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"; // valid UUID, not existing
      const res = await request(baseURL)
        .get(`${endpoint}/${randomId}`)
        .set("Cookie", authCookie);
      expect(res.status).toBe(404);
      expect(res.body).toEqual({ detail: "Version not found" });
    });
  
    it("VER-GET-003: Invalid version_id format", async () => {
      const invalidId = "invalid-id";
      const res = await request(baseURL)
        .get(`${endpoint}/${invalidId}`)
        .set("Cookie", authCookie);
  
      expect(res.status).toBe(422);
      expect(res.body).toHaveProperty("detail");
    });
  
});

// -------------------------------------------------------------------------
// GET /api/versions/application/{application_id}tests
// -------------------------------------------------------------------------
describe("Versions API - GET /versions/application/{application_id}", () => {

  it("VER-LIST-001: List versions by application (happy path)", async () => {
    const res = await request(baseURL)
      .get(`${versionsEndpoint}/${testApp.id}`)
      .set("Cookie", authCookie);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
  });

  it("VER-LIST-002: Empty list when no versions exist", async () => {
    // Create a new app with no versions
    const appRes = await request(baseURL)
      .post(applicationsEndpoint)
      .set("Cookie", authCookie)
      .send({
        name: "Empty Version App",
        description: "No versions",
        customer_id: validCustomerId,
      });

    expect([200, 201]).toContain(appRes.status);
    const emptyAppId = appRes.body.id;

    const res = await request(baseURL)
      .get(`${versionsEndpoint}/${emptyAppId}`)
      .set("Cookie", authCookie);

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it("VER-LIST-003: Pagination works (skip=5, limit=10)", async () => {
    const res = await request(baseURL)
      .get(`${versionsEndpoint}/${testApp.id}`)
      .query({ skip: 5, limit: 10 })
      .set("Cookie", authCookie);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeLessThanOrEqual(10);
  });

  it("VER-LIST-004: Invalid application_id format", async () => {
    const invalidId = "bad-uuid";
    const res = await request(baseURL)
      .get(`${versionsEndpoint}/${invalidId}`)
      .set("Cookie", authCookie);

    expect(res.status).toBe(422);
    expect(res.body).toHaveProperty("detail");
  });

  it("VER-LIST-005: Large limit stress (limit=5000)", async () => {
    const res = await request(baseURL)
      .get(`${versionsEndpoint}/${testApp.id}`)
      .query({ limit: 5000 })
      .set("Cookie", authCookie);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

});
// -------------------------------------------------------------------------
// PUT /versions/{version_id} tests
// -------------------------------------------------------------------------
describe("Versions API - PUT /versions/{version_id}", () => {
  it("VER-PUT-001: Update version (happy path)", async () => {
    const res = await request(baseURL)
      .put(`${endpoint}/${testVersion.id}`)
      .set("Cookie", authCookie)
      .send({
        changelog: "fixed bugs",
        is_active: true,
      });

    expect(res.status).toBe(200);
    expect(res.body.changelog).toBe("fixed bugs");
    expect(res.body.is_active).toBe(true);
  });

  it("VER-PUT-002: Version not found", async () => {
    const fakeId = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
    const res = await request(baseURL)
      .put(`${endpoint}/${fakeId}`)
      .set("Cookie", authCookie)
      .send({ changelog: "update" });

    expect(res.status).toBe(404);
    expect(res.body.detail).toBeDefined();
  });

  it("VER-PUT-003: Invalid version_id format", async () => {
    const res = await request(baseURL)
      .put(`${endpoint}/invalid-id`)
      .set("Cookie", authCookie)
      .send({ changelog: "update" });

    expect(res.status).toBe(422);
    expect(res.body.detail).toBeDefined();
  });

  it("VER-PUT-004: Invalid body types", async () => {
    const res = await request(baseURL)
      .put(`${endpoint}/${testVersion.id}`)
      .set("Cookie", authCookie)
      .send({ is_active: "yes" }); // invalid type

    expect(res.status).toBe(422);
    expect(res.body.detail).toBeDefined();
  });

  it("VER-PUT-005: Change application_id (if allowed)", async () => {
    // create a second app
    const secondAppRes = await request(baseURL)
      .post(applicationsEndpoint)
      .set("Cookie", authCookie)
      .send({
        name: "Second App",
        description: "For re-parenting test",
        customer_id: validCustomerId,
        initial_version: "0.1.0",
      });
    expect([200, 201]).toContain(secondAppRes.status);
    const secondAppId = secondAppRes.body.id;

    const res = await request(baseURL)
      .put(`${endpoint}/${testVersion.id}`)
      .set("Cookie", authCookie)
      .send({ application_id: secondAppId });

    expect([400, 422]).toContain(res.status); 
  });

  it("VER-PUT-006: Set is_active flags/toggles", async () => {
    const res = await request(baseURL)
      .put(`${endpoint}/${testVersion.id}`)
      .set("Cookie", authCookie)
      .send({ is_active: false });

    expect(res.status).toBe(200);
    expect(res.body.is_active).toBe(false);
  });
});
// -------------------------------------------------------------------------
// DELETE /versions/{version_id} tests
// -------------------------------------------------------------------------
describe("Versions API - DELETE /versions/{version_id}", () => {
  
  it("VER-DEL-001: Delete version (happy path)", async () => {
    const res = await request(baseURL)
      .delete(`${endpoint}/${testVersion.id}`)
      .set("Cookie", authCookie);

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(testVersion.id);
  });

  it("VER-DEL-002: Version not found", async () => {
    const randomId = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"; // valid UUID, not existing
    const res = await request(baseURL)
      .delete(`${endpoint}/${randomId}`)
      .set("Cookie", authCookie);

    expect(res.status).toBe(404);
    expect(res.body.detail).toBe("Version not found");
  });

  it("VER-DEL-003: Double delete (idempotency check)", async () => {
    // First delete (already deleted in VER-DEL-001)
    const res = await request(baseURL)
      .delete(`${endpoint}/${testVersion.id}`)
      .set("Cookie", authCookie);

    expect(res.status).toBe(404);
    expect(res.body.detail).toBe("Version not found");
  });

  it("VER-DEL-004: Delete version in use (active version linked to app)", async () => {
    // Step 1: Create a new version
    const linkedVersionRes = await request(baseURL)
        .post(endpoint)
        .set("Cookie", authCookie)
        .send({
        application_id: testApp.id,
        version: "2.0.0",
        changelog: "version active",
        is_active: true, // mark as active / in use
        });

    expect(linkedVersionRes.status).toBe(200);
    const linkedVersion = linkedVersionRes.body;

    const res = await request(baseURL)
        .delete(`${endpoint}/${linkedVersion.id}`)
        .set("Cookie", authCookie);
    expect([400, 409]).toContain(res.status);
    });

});
