import express from 'express';
import cors from 'cors';

const app = express();
const PORT = 5000;

// CORS simples
app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:5175', 'http://127.0.0.1:5175'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
}));

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    message: 'Backend funcionando!'
  });
});

// Login endpoint
app.post('/api/login', (req, res) => {
  console.log('Login request received:', req.body);
  res.json({ 
    success: true, 
    message: 'Login endpoint funcionando',
    timestamp: new Date().toISOString()
  });
});

// User endpoint
app.get('/api/user', (req, res) => {
  console.log('User request received');
  res.json({ 
    success: true, 
    message: 'User endpoint funcionando',
    timestamp: new Date().toISOString()
  });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Test server rodando em http://localhost:${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
}); 