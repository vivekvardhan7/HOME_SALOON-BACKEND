#!/usr/bin/env node

/**
 * Simple script to start the server and verify it's running
 */

const { spawn } = require('child_process');
const http = require('http');

console.log('🚀 Starting backend server...\n');

const serverProcess = spawn('npm', ['run', 'dev'], {
  cwd: __dirname,
  shell: true,
  stdio: 'inherit'
});

// Wait a bit for server to start, then check health
setTimeout(() => {
  console.log('\n🔍 Checking if server is running...\n');
  
  const req = http.get('http://localhost:3001/api/health', (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
      console.log('✅ Server is running!');
      console.log('📝 Response:', data);
      console.log('\n📍 You can now login at: http://localhost:5173/login');
      console.log('   Admin: admin@homebonzenga.com / admin123');
      console.log('   Manager: manager@homebonzenga.com / manager123\n');
    });
  });
  
  req.on('error', (err) => {
    console.log('⏳ Server is still starting... Give it a few more seconds.');
    console.log('   If this persists, check the server logs above for errors.\n');
  });
  
  req.setTimeout(3000, () => {
    req.destroy();
    console.log('⏳ Server is still starting... This is normal.');
    console.log('   Check the output above for "Server running on port 3001"\n');
  });
}, 5000);

// Handle process exit
process.on('SIGINT', () => {
  console.log('\n\n🛑 Stopping server...');
  serverProcess.kill();
  process.exit(0);
});

serverProcess.on('exit', (code) => {
  if (code !== 0 && code !== null) {
    console.error(`\n❌ Server exited with code ${code}`);
    console.error('Check the logs above for errors.\n');
  }
});

