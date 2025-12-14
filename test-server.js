const express = require('express');
const cors = require('cors');

const app = express();
const PORT = 3001;

// CORS configuration
app.use(cors({
  origin: 'http://localhost:8081',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Simple auth endpoints for testing
app.post('/api/auth/login', (req, res) => {
  console.log('Login attempt:', req.body);
  res.json({ 
    message: 'Login endpoint working',
    user: { id: '1', email: req.body.email, role: 'CUSTOMER' },
    accessToken: 'test-token'
  });
});

app.post('/api/auth/register', (req, res) => {
  console.log('Registration attempt:', req.body);
  res.json({ 
    message: 'Registration successful',
    user: { 
      id: '2', 
      email: req.body.email, 
      firstName: req.body.firstName,
      lastName: req.body.lastName,
      role: req.body.role || 'CUSTOMER' 
    },
    accessToken: 'test-token'
  });
});

app.listen(PORT, () => {
  console.log(`Test server running on port ${PORT}`);
  console.log(`CORS origin: http://localhost:8081`);
});
