// Load environment variables from .env file
require('dotenv').config();

// Simple configuration for development
// Use SQLite by default for local dev to match prisma schema
process.env.DATABASE_URL = process.env.DATABASE_URL || "file:./prisma/dev.db";
process.env.JWT_SECRET = process.env.JWT_SECRET || "your-super-secret-jwt-key-for-development";
process.env.JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "7d";
process.env.JWT_REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || "30d";
process.env.PORT = process.env.PORT || "3001";
process.env.NODE_ENV = process.env.NODE_ENV || "development";
process.env.CORS_ORIGIN = process.env.CORS_ORIGIN || "http://localhost:5173";

module.exports = {};
