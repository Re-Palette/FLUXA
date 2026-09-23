process.env.DATABASE_URL = process.env.TEST_DATABASE_URL ?? "postgresql://fluxa:fluxa@localhost:5432/fluxa_test";
process.env.ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");
process.env.AUTH_SECRET = "test-secret-test-secret-test-secret-123456";
process.env.APP_URL = "http://localhost:3000";
