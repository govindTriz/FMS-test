const path = require("path");

// Force dotenv to load the .env file from repo root
require("dotenv").config({ path: path.resolve(__dirname, ".env"), debug: false });

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

jest.setTimeout(30000);

