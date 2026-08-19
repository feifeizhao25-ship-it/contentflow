#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const settingsPath = path.join(
  __dirname,
  '..',
  'node_modules',
  '@react-native',
  'gradle-plugin',
  'settings.gradle.kts',
);

const resolverLine =
  'plugins { id("org.gradle.toolchains.foojay-resolver-convention").version("0.5.0") }';
const patchedLine =
  '// Disabled by scripts/patch-react-native-gradle-plugin.js: local builds provide JDK 17 explicitly.';

if (!fs.existsSync(settingsPath)) {
  console.warn(`[postinstall] React Native Gradle plugin settings not found: ${settingsPath}`);
  process.exit(0);
}

const source = fs.readFileSync(settingsPath, 'utf8');

if (source.includes(patchedLine)) {
  console.log('[postinstall] React Native Gradle plugin already patched.');
  process.exit(0);
}

if (!source.includes(resolverLine)) {
  console.log('[postinstall] Foojay resolver line not present; no patch needed.');
  process.exit(0);
}

fs.writeFileSync(settingsPath, source.replace(resolverLine, patchedLine));
console.log('[postinstall] Disabled React Native Foojay resolver for deterministic JDK 17 builds.');