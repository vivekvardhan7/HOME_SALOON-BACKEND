// Load configuration first
require('../config.js');

import express from 'express';
import cors from 'cors';
import { auth } from './lib/auth';

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({
  origin: process.env.CORS_ORIGIN || "http://localhost:5173",
  credentials: true
}));
app.use(express.json());

// Simple in-memory user storage for demo
const users: any[] = [];

// Auth routes
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Handle static admin and manager credentials
    if (email === 'admin@homebonzenga.com' && password === 'Admin@123') {
      const adminUser = {
        id: 'admin-static-id',
        email: 'admin@homebonzenga.com',
        firstName: 'Admin',
        lastName: 'User',
        role: 'ADMIN',
        status: 'ACTIVE',
        phone: null,
        avatar: null,
        fcmToken: null,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const tokens = auth.generateTokens(adminUser as any);
      console.log(`Admin logged in: ${adminUser.email}`);

      return res.json({
        user: adminUser,
        ...tokens
      });
    }

    // Find user in memory storage
    const user = users.find(u => u.email === email);
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Check password
    const isValidPassword = await auth.comparePassword(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Generate tokens
    const tokens = auth.generateTokens(user);

    // Return user without password
    const { password: _, ...userWithoutPassword } = user;

    console.log(`User logged in: ${user.email}`);

    res.json({
      user: userWithoutPassword,
      ...tokens
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, password, firstName, lastName, phone, role } = req.body;

    // Check if user already exists
    const existingUser = users.find(u => u.email === email);
    if (existingUser) {
      return res.status(400).json({ error: 'User already exists' });
    }

    // Hash password
    const hashedPassword = await auth.hashPassword(password);

    // Create user
    const user = {
      id: `user-${Date.now()}`,
      email,
      firstName,
      lastName,
      phone,
      role: role || 'CUSTOMER',
      status: 'ACTIVE',
      password: hashedPassword,
      avatar: null,
      fcmToken: null,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // Store user in memory
    users.push(user);

    // Generate tokens
    const tokens = auth.generateTokens(user as any);

    // Return user without password
    const { password: _, ...userWithoutPassword } = user;

    console.log(`User registered: ${user.email}`);

    res.status(201).json({
      user: userWithoutPassword,
      ...tokens
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'Simple auth server running' });
});

app.listen(PORT, () => {
  console.log(`🚀 Simple server running on port ${PORT}`);
  console.log(`🌐 CORS enabled for: ${process.env.CORS_ORIGIN || "http://localhost:5173"}`);
  console.log(`📝 Demo accounts available:`);
  console.log(`   Admin: admin@homebonzenga.com / Admin@123`);
  console.log(`   Manager: manager@homebonzenga.com / Manager@123`);
});

export default app;