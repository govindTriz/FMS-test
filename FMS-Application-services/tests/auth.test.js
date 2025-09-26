const request = require("supertest");
jest.setTimeout(30000);
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0"; // allow self-signed certs

const baseURL = "https://192.168.1.220:8443";
const applicationsEndpoint = "/api/applications";
const validCustomerId = "f28129bd-e9d9-4c5c-9860-29a7c92bd8a5";
const versionsEndpoint = "/api/versions";

// -------------------------------------------------------------------------
// Application Identity/Auth Headers
// -------------------------------------------------------------------------
describe("Applications API - Identity/Authentication headers", () => {
  
  it("APP-AUTH-001: POST /applications without identity headers", async () => {
    const payload = {
      name: "App One",
      customer_id: validCustomerId,
    };

    const res = await request(baseURL)
      .post(applicationsEndpoint)
      .send(payload);

    expect([401, 403]).toContain(res.status);
    expect(res.body).toHaveProperty("error");
    expect(res.body.error).toContain("unauthorized")
  });

  it("APP-AUTH-002: GET /applications/{id} with malformed headers", async () => {
    const appId = "app-001"; // example application id

    const res = await request(baseURL)
      .get(`${applicationsEndpoint}/${appId}`)
      .set("X-Current-Identity", "malformed-header"); // intentionally bad

    expect([401, 403]).toContain(res.status);
    expect(res.body).toHaveProperty("error");
    expect(res.body.error).toContain("unauthorized")
  });

});

// -------------------------------------------------------------------------
// Versions Identity/Auth Headers
// -------------------------------------------------------------------------
describe("Versions API - Identity/Authentication headers", () => {

  it("VER-AUTH-001: POST /versions without identity headers should fail", async () => {
    const payload = {
      application_id: "f28129bd-e9d9-4c5c-9860-29a7c92bd8a5",
      version: "1.0.0",
      changelog: "init",
    };

    const res = await request(baseURL)
      .post(versionsEndpoint)
      // no auth headers
      .send(payload);

    expect([401, 403]).toContain(res.status);
    expect(res.body).toHaveProperty("error");
    expect(res.body.error).toContain("unauthorized")
  });

  it("VER-AUTH-002: GET /versions/{id} with malformed headers should fail", async () => {
    const versionId = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"; // example UUID

    const res = await request(baseURL)
      .get(`${versionsEndpoint}/${versionId}`)
      .set("X-Current-Identity", "malformed-header"); // intentionally bad

    expect([401, 403]).toContain(res.status);
    expect(res.body).toHaveProperty("error");
    expect(res.body.error).toContain("unauthorized")
  });

});

