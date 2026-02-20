process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-must-be-at-least-32-chars';
process.env.JWT_REFRESH_SECRET = 'test-jwt-refresh-secret-must-be-32-chars';
process.env.POW_DIFFICULTY = '8';
process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://albayt:albayt_dev_password@localhost:5432/albayt_test';
