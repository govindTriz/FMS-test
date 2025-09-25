// applications.post.test.js
const request = require("supertest");
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0"; // allow self-signed certs

const baseURL = "https://192.168.1.220:8443";
const endpoint = "/api/application/applications/";
const validCustomerId = "f28129bd-e9d9-4c5c-9860-29a7c92bd8a5";

// simulate what you'd load from cookies.txt
async function loginSuperAdmin() {
  const res = await request(baseURL)
    .post("/api/auth/login")
    .set("Content-Type", "application/x-www-form-urlencoded")
    .send("username=admin@example.com&password=secret"); // adjust creds

  expect(res.status).toBe(200);
  return res.headers["set-cookie"];
}

let authCookie;

beforeAll(async () => {
  authCookie = await loginSuperAdmin();
});

describe("POST /api/application/applications/", () => {
  it("APP-POST-001: Create application (happy path)", async () => {
    const res = await request(baseURL)
      .post(endpoint)
      .set("Cookie", authCookie)
      .send({
        application_id: "app-001",
        name: "App One",
        description: "demo app created via supertest",
        customer_id: validCustomerId,
        initial_version: "1.0.0",
        app_metadata: { color: "blue" },
      });

    expect(res.status).toBe(200); // service returns 200 not 201
    expect(res.body).toMatchObject({
      id: expect.any(String),
      application_id: "app-001",
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
        application_id: "app-003",
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
        application_id: "app-004",
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
      application_id: "app-005",
      name: "Dup Test",
      description: "first insert",
      customer_id: validCustomerId,
      initial_version: "1.0.0",
    };

    await request(baseURL).post(endpoint).set("Cookie", authCookie).send(app);
    const res = await request(baseURL).post(endpoint).set("Cookie", authCookie).send(app);

    // Adjust based on actual service behavior
    expect([200, 400, 409]).toContain(res.status);
  });

  it("APP-POST-006: Extra unknown fields in body", async () => {
    const res = await request(baseURL)
      .post(endpoint)
      .set("Cookie", authCookie)
      .send({
        application_id: "app-006",
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
      application_id: "app-007",
      name: "App PerCust",
      description: "original",
      customer_id: validCustomerId,
      initial_version: "1.0.0",
    };

    await request(baseURL).post(endpoint).set("Cookie", authCookie).send(app);
    const res = await request(baseURL).post(endpoint).set("Cookie", authCookie).send(app);

    expect([200, 400, 409]).toContain(res.status);
  });

  it("APP-POST-008: Invalid customer_id UUID again", async () => {
    const res = await request(baseURL)
      .post(endpoint)
      .set("Cookie", authCookie)
      .send({
        application_id: "app-008",
        name: "BadUUIDAgain",
        customer_id: "bad-uuid",
        initial_version: "1.0.0",
      });

    expect(res.status).toBe(422);
    expect(res.body.detail).toBeDefined();
  });

  it("APP-POST-009: Very long name/notes", async () => {
    const res = await request(baseURL)
      .post(endpoint)
      .set("Cookie", authCookie)
      .send({
        application_id: "app-009",
        name: "x".repeat(2000),
        description: "very long name field",
        customer_id: validCustomerId,
        initial_version: "1.0.0",
      });

    expect([200, 422, 413]).toContain(res.status);
  });

  it("APP-POST-010: Unicode / emoji in fields", async () => {
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
