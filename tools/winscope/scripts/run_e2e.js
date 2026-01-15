const { spawn, execSync } = require('child_process');
const net = require('net');

const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const RESET = '\x1b[0m';

function log(msg) {
  console.log(`${GREEN}[E2E Runner] ${msg}${RESET}`);
}

function error(msg) {
  console.error(`${RED}[E2E Runner] ${msg}${RESET}`);
}

async function checkPort(port, timeout = 120000) {
  log(`Checking port ${port}...`);
  const start = Date.now();
  while (Date.now() - start < timeout) {
    try {
      await new Promise((resolve, reject) => {
        const socket = new net.Socket();
        socket.setTimeout(200);
        socket.on('connect', () => {
          socket.destroy();
          resolve();
        });
        socket.on('timeout', () => {
          socket.destroy();
          reject(new Error('timeout'));
        });
        socket.on('error', (err) => {
          socket.destroy();
          reject(err);
        });
        socket.connect(port, 'localhost');
      });
      log(`Port ${port} is ready!`);
      return true;
    } catch (e) {
      await new Promise((r) => setTimeout(r, 1000));
    }
  }
  throw new Error(`Timeout waiting for port ${port}`);
}

async function checkUrl(url, timeout = 120000) {
  log(`Checking URL ${url}...`);
  const start = Date.now();
  while (Date.now() - start < timeout) {
    try {
      execSync(`curl -s -f -o /dev/null --max-time 1 ${url}`);
      log(`URL ${url} is ready!`);
      return true;
    } catch (e) {
      await new Promise(r => setTimeout(r, 1000));
    }
  }
  throw new Error(`Timeout waiting for URL ${url}`);
}

async function run() {
  const processes = [];

  const cleanup = () => {
    log('Stopping all processes...');
    processes.forEach((p) => {
      if (!p.killed) p.kill();
    });
  };

  process.on('SIGINT', () => {
    cleanup();
    process.exit(1);
  });

  process.on('exit', cleanup);

  try {
    // 1. Install chromedriver (sync)
    log('Installing chromedriver...');
    execSync('npm run install:chromedriver', { stdio: 'inherit' });

    // 2. Build E2E tests (sync)
    log('Cleaning up E2E test output directories...');
    execSync('rm -rf dist/e2e_test && npx tsc -p ./src/test/e2e', { stdio: 'inherit' });

    // 3. Start Remote Tool Mock (async)
    log('Starting Remote Tool Mock (port 8081)...');
    const mock = spawn('ng', ['serve', 'remote-tool-mock'], { stdio: 'inherit', shell: true });
    processes.push(mock);

    // 4. Start Angular App (async)
    log('Starting Angular App (port 8080, remote tool proxy: 8080/mock)...');
    const app = spawn('ng', ['serve', 'winscope'], { stdio: 'inherit', shell: true });
    processes.push(app);

    // 5. Wait for ports
    log('Waiting for services to be ready...');
    await Promise.all([
      checkPort(8080),
      checkPort(8081),
      checkUrl('http://localhost:8081/index.html'),
      checkUrl('http://localhost:8080/index.html'),
      checkUrl('http://localhost:8080/mock/index.html'),
    ]);
    log('Services are ready!');

    // 6. Build tests
    log('building tests...');
    execSync('npx tsc -p src/test/e2e/tsconfig.json', { stdio: 'inherit' });

    // 7. Run Protractor
    log('Running Protractor...');
    try {
      execSync('npx protractor protractor.config.js --verbose', { stdio: 'inherit' });
      log('E2E Tests Passed! 🎉');
    } catch (e) {
      error('E2E Tests Failed! 💥');
      process.exit(1);
    }

  } catch (e) {
    error(`Error: ${e.message}`);
    process.exit(1);
  }
}

run();
