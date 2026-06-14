const fs = require('fs');
const path = require('path');

const CANDIDATE_PATHS = [
  // Global npm (macOS Homebrew /usr/local, Linux /usr)
  '/usr/local/lib/node_modules/9router/app/custom-server.js',
  '/usr/lib/node_modules/9router/app/custom-server.js',
  '/opt/homebrew/lib/node_modules/9router/app/custom-server.js',
  // User-level npm
  path.join(require('os').homedir(), '.nvm/versions/node', process.version, 'lib/node_modules/9router/app/custom-server.js'),
  path.join(require('os').homedir(), '.npm-global/lib/node_modules/9router/app/custom-server.js'),
  path.join(require('os').homedir(), 'node_modules/9router/app/custom-server.js'),
  // npx or local
  path.join(process.cwd(), 'node_modules/9router/app/custom-server.js'),
  // Yarn
  path.join(require('os').homedir(), '.config/yarn/global/node_modules/9router/app/custom-server.js'),
];

function detectInstallPath() {
  if (process.env.ROUTER_CUSTOM_SERVER) {
    const envPath = process.env.ROUTER_CUSTOM_SERVER;
    if (fs.existsSync(envPath)) return envPath;
  }

  for (const candidate of CANDIDATE_PATHS) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  // Fallback: try `npm root -g`
  try {
    const { execSync } = require('child_process');
    const npmRoot = execSync('npm root -g', { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] }).trim();
    const guess = path.join(npmRoot, '9router/app/custom-server.js');
    if (fs.existsSync(guess)) return guess;
  } catch {
    // ignore
  }

  return null;
}

module.exports = { detectInstallPath };
