#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const nextDir = path.join(root, '.next');
const standaloneDir = path.join(nextDir, 'standalone');

function assertExists(target, label) {
  if (!fs.existsSync(target)) {
    throw new Error(`${label} is missing: ${target}. Run \`npm run build\` first.`);
  }
}

function copyFresh(from, to) {
  fs.rmSync(to, { recursive: true, force: true });
  fs.cpSync(from, to, { recursive: true });
}

assertExists(path.join(standaloneDir, 'server.js'), 'Next standalone server');
assertExists(path.join(nextDir, 'static'), 'Next static assets');
assertExists(path.join(root, 'public'), 'Public assets');

fs.mkdirSync(path.join(standaloneDir, '.next'), { recursive: true });
copyFresh(path.join(nextDir, 'static'), path.join(standaloneDir, '.next', 'static'));
copyFresh(path.join(root, 'public'), path.join(standaloneDir, 'public'));

console.log(`Standalone package ready: ${standaloneDir}`);