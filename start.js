const { spawn } = require('child_process');
const path = require('path');

console.log('Starting WebVault backend and frontend...');

// Helper to pipe output with a prefix
function logProcess(proc, name) {
  proc.stdout.on('data', (data) => {
    const lines = data.toString().split('\n');
    lines.forEach(line => {
      if (line.trim()) console.log(`[${name}] ${line.trim()}`);
    });
  });
  proc.stderr.on('data', (data) => {
    const lines = data.toString().split('\n');
    lines.forEach(line => {
      if (line.trim()) console.error(`[${name} ERROR] ${line.trim()}`);
    });
  });
  proc.on('close', (code) => {
    console.log(`[${name}] process exited with code ${code}`);
  });
}

// Start backend
const backend = spawn('npm', ['run', 'dev'], {
  cwd: path.join(__dirname, 'backend'),
  shell: true
});
logProcess(backend, 'Backend');

// Start frontend
const frontend = spawn('npx', ['-y', 'http-server', 'frontend', '-p', '3000'], {
  cwd: __dirname,
  shell: true
});
logProcess(frontend, 'Frontend');

console.log('\n--- WebVault Launcher ---');
console.log('Backend will run at:  http://localhost:5000');
console.log('Frontend will run at: http://localhost:3000');
console.log('Press Ctrl+C to stop both servers.\n');

// Clean up processes on exit
process.on('SIGINT', () => {
  console.log('\nShutting down WebVault...');
  backend.kill();
  frontend.kill();
  process.exit();
});

process.on('SIGTERM', () => {
  console.log('\nShutting down WebVault...');
  backend.kill();
  frontend.kill();
  process.exit();
});
