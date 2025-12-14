import { Router } from 'express';
import { z } from 'zod';
import { logger } from '../lib/logger';

const router = Router();

// Mock users for testing
const mockUsers = [
  {
    id: '1',
    email: 'admin@homebonzenga.com',
    password: 'admin123', // In real app, this would be hashed
    firstName: 'Admin',
    lastName: 'User',
    role: 'ADMIN',
    status: 'ACTIVE'
  },
  {
    id: '2',
    email: 'customer@test.com',
    password: 'customer123',
    firstName: 'John',
    lastName: 'Doe',
    role: 'CUSTOMER',
    status: 'ACTIVE'
  },
  {
    id: '3',
    email: 'vendor@test.com',
    password: 'vendor123',
    firstName: 'Jane',
    lastName: 'Smith',
    role: 'VENDOR',
    status: 'ACTIVE'
  }
];

// Validation schemas
const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  phone: z.string().optional(),
  role: z.enum(['CUSTOMER', 'VENDOR']).default('CUSTOMER')
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
});

// Simple JWT-like token generation (for testing only)
const generateToken = (user: any) => {
  const payload = {
    userId: user.id,
    email: user.email,
    role: user.role,
    type: 'access'
  };
  // Simple base64 encoding for testing (not secure for production)
  return Buffer.from(JSON.stringify(payload)).toString('base64');
};

// POST /api/auth/register
router.post('/register', async (req, res, next) => {
  try {
    const data = registerSchema.parse(req.body);

    // Check if user already exists
    const existingUser = mockUsers.find(u => u.email === data.email);
    if (existingUser) {
      return res.status(400).json({ error: 'User already exists' });
    }

    // Create new user
    const newUser = {
      id: (mockUsers.length + 1).toString(),
      ...data,
      status: 'ACTIVE'
    };
    mockUsers.push(newUser);

    // Generate tokens
    const accessToken = generateToken(newUser);
    const refreshToken = generateToken({ ...newUser, type: 'refresh' });

    logger.info(`User registered: ${newUser.email}`);

    res.status(201).json({
      user: {
        id: newUser.id,
        email: newUser.email,
        firstName: newUser.firstName,
        lastName: newUser.lastName,
        role: newUser.role,
        status: newUser.status
      },
      accessToken,
      refreshToken
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/auth/login
router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = loginSchema.parse(req.body);

    // Find user
    const user = mockUsers.find(u => u.email === email);
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Check password (simple comparison for testing)
    if (user.password !== password) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Check if user is active
    if (user.status !== 'ACTIVE') {
      return res.status(401).json({ error: 'Account is suspended or pending' });
    }

    // Generate tokens
    const accessToken = generateToken(user);
    const refreshToken = generateToken({ ...user, type: 'refresh' });

    // Return user without password
    const { password: _, ...userWithoutPassword } = user;

    logger.info(`User logged in: ${user.email}`);

    res.json({
      user: userWithoutPassword,
      accessToken,
      refreshToken
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/auth/refresh
router.post('/refresh', async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    
    if (!refreshToken) {
      return res.status(401).json({ error: 'Refresh token required' });
    }

    // Decode token (simple base64 for testing)
    try {
      const payload = JSON.parse(Buffer.from(refreshToken, 'base64').toString());
      
      if (payload.type !== 'refresh') {
        return res.status(401).json({ error: 'Invalid token type' });
      }

      // Find user
      const user = mockUsers.find(u => u.id === payload.userId);
      if (!user || user.status !== 'ACTIVE') {
        return res.status(401).json({ error: 'User not found' });
      }

      // Generate new tokens
      const newAccessToken = generateToken(user);
      const newRefreshToken = generateToken({ ...user, type: 'refresh' });

      res.json({
        accessToken: newAccessToken,
        refreshToken: newRefreshToken
      });
    } catch (decodeError) {
      return res.status(401).json({ error: 'Invalid token' });
    }
  } catch (error) {
    next(error);
  }
});

// POST /api/auth/logout
router.post('/logout', async (req, res) => {
  // In a more sophisticated setup, you'd blacklist the token
  res.json({ message: 'Logged out successfully' });
});

// GET /api/auth/me
router.get('/me', async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.substring(7);
    
    try {
      const payload = JSON.parse(Buffer.from(token, 'base64').toString());
      
      if (payload.type !== 'access') {
        return res.status(401).json({ error: 'Invalid token type' });
      }

      const user = mockUsers.find(u => u.id === payload.userId);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      const { password: _, ...userWithoutPassword } = user;
      res.json({ user: userWithoutPassword });
    } catch (decodeError) {
      return res.status(401).json({ error: 'Invalid token' });
    }
  } catch (error) {
    next(error);
  }
});

export { router as authMockRoutes };
