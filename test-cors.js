const http = require('http');

// Teste simples de CORS
const options = {
  hostname: 'localhost',
  port: 5000,
  path: '/health',
  method: 'GET',
  headers: {
    'Origin': 'http://127.0.0.1:5175',
    'Content-Type': 'application/json'
  }
};

const req = http.request(options, (res) => {
  console.log('Status:', res.statusCode);
  console.log('Headers:', res.headers);
  
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    console.log('Response:', data);
  });
});

req.on('error', (e) => {
  console.error('Error:', e.message);
});

req.end(); 