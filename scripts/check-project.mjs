import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(scriptDirectory, '..');
const failures = [];
let checks = 0;

function record(condition, message) {
  checks += 1;
  if (!condition) failures.push(message);
}

function projectPath(relativePath) {
  return path.join(root, relativePath.replace(/^\.\//, ''));
}

function read(relativePath) {
  const absolutePath = projectPath(relativePath);
  record(fs.existsSync(absolutePath), `Missing required file: ${relativePath}`);
  return fs.existsSync(absolutePath) ? fs.readFileSync(absolutePath, 'utf8') : '';
}

const html = read('index.html');
const manifestSource = read('manifest.webmanifest');
const serviceWorker = read('sw.js');

for (const requiredPath of [
  'README.md',
  'PROJECT_STATUS.md',
  'vendor/vue.global.prod.js',
  'vendor/tailwind-local.css',
  'vendor/html-to-image.min.js'
]) {
  record(fs.existsSync(projectPath(requiredPath)), `Missing required file: ${requiredPath}`);
}

const inlineScripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)]
  .map(match => match[1])
  .filter(source => source.trim());

record(inlineScripts.length > 0, 'No inline application script found in index.html');
for (const [index, source] of inlineScripts.entries()) {
  try {
    new Function(source);
    record(true, `Inline script ${index + 1} is valid`);
  } catch (error) {
    record(false, `Inline script ${index + 1} has invalid syntax: ${error.message}`);
  }
}

let manifest = null;
try {
  manifest = JSON.parse(manifestSource);
  record(true, 'Manifest JSON is valid');
} catch (error) {
  record(false, `Manifest JSON is invalid: ${error.message}`);
}

try {
  new Function(serviceWorker);
  record(true, 'Service worker JavaScript is valid');
} catch (error) {
  record(false, `Service worker JavaScript is invalid: ${error.message}`);
}

const staticReferences = [...html.matchAll(/\s(?:src|href)="([^"]+)"/g)]
  .map(match => match[1])
  .filter(reference => !/^(?:data:|https?:|#)/i.test(reference));

for (const reference of new Set(staticReferences)) {
  record(fs.existsSync(projectPath(reference)), `HTML references a missing file: ${reference}`);
}

if (manifest) {
  record(manifest.start_url === './index.html', 'Manifest start_url must remain ./index.html');
  record(manifest.display === 'standalone', 'Manifest display must remain standalone');
  for (const icon of manifest.icons ?? []) {
    record(fs.existsSync(projectPath(icon.src)), `Manifest references a missing icon: ${icon.src}`);
  }
}

const cachedPaths = [...serviceWorker.matchAll(/['"]\.\/([^'"]*)['"]/g)]
  .map(match => match[1]);

for (const cachedPath of new Set(cachedPaths)) {
  record(fs.existsSync(projectPath(cachedPath)), `Service worker caches a missing path: ./${cachedPath}`);
}

record(/STATE_STORAGE_KEY\s*=\s*['"]wechat_editor_state_v19['"]/.test(html), 'Expected current localStorage key wechat_editor_state_v19 was not found');
record(/LEGACY_STATE_STORAGE_KEY\s*=\s*['"]wechat_editor_state_v18['"]/.test(html), 'Expected legacy v18 migration key was not found');
record(/CURRENT_STATE_SCHEMA\s*=\s*2/.test(html), 'Expected state schema version 2 was not found');
record(/wechat-screenshot-pwa-v\d+/.test(serviceWorker), 'Versioned PWA cache name was not found');
record(/pixelRatio:\s*3/.test(html), 'Expected 3x PNG export configuration was not found');
record(/activePage:\s*['"]home['"]/.test(html), 'Expected home page initial state was not found');

const fixturePaths = [
  'tests/fixtures/export-baseline-state.json',
  'tests/fixtures/all-message-types-state.json'
];
const fixtures = [];

for (const fixturePath of fixturePaths) {
  try {
    const fixture = JSON.parse(read(fixturePath));
    fixtures.push({ fixturePath, fixture });
    record(Array.isArray(fixture.messages), `${fixturePath} must contain a messages array`);
    for (const imagePath of [fixture.myAvatar, fixture.otherAvatar]) {
      record(typeof imagePath === 'string' && fs.existsSync(projectPath(imagePath)), `${fixturePath} references a missing avatar: ${imagePath}`);
    }
    for (const message of fixture.messages ?? []) {
      if (message.type === 'image') {
        record(typeof message.imageUrl === 'string' && fs.existsSync(projectPath(message.imageUrl)), `${fixturePath} references a missing message image: ${message.imageUrl}`);
      }
    }
  } catch (error) {
    record(false, `${fixturePath} is invalid: ${error.message}`);
  }
}

const allTypesFixture = fixtures.find(item => item.fixturePath.endsWith('all-message-types-state.json'))?.fixture;
const expectedMessageTypes = ['text', 'image', 'voice', 'transfer', 'call', 'nudge', 'time', 'redPacket'];
const fixtureMessageTypes = new Set((allTypesFixture?.messages ?? []).map(message => message.type));
for (const messageType of expectedMessageTypes) {
  record(fixtureMessageTypes.has(messageType), `All-message-types fixture is missing type: ${messageType}`);
}

const baselinePath = projectPath('tests/baseline/export-baseline-light.png');
record(fs.existsSync(baselinePath), 'Missing visual baseline: tests/baseline/export-baseline-light.png');
if (fs.existsSync(baselinePath)) {
  const png = fs.readFileSync(baselinePath);
  const isPng = png.length >= 24 && png.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  record(isPng, 'Visual baseline is not a valid PNG');
  if (isPng) {
    record(png.readUInt32BE(16) === 1125, `Visual baseline width must be 1125, found ${png.readUInt32BE(16)}`);
    record(png.readUInt32BE(20) === 2436, `Visual baseline height must be 2436, found ${png.readUInt32BE(20)}`);
  }
}

if (failures.length) {
  console.error(`Project checks failed (${failures.length}/${checks}):`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exitCode = 1;
} else {
  console.log(`Project checks passed (${checks} checks).`);
}
