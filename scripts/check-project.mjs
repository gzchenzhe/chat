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
const appScript = read('js/app.js');
const appCss = read('css/app.css');
const packageSource = read('package.json');
const manifestSource = read('manifest.webmanifest');
const serviceWorker = read('sw.js');
const wranglerSource = read('wrangler.jsonc');
const assetsIgnore = read('.assetsignore');
const applicationSource = `${html}\n${appScript}`;

for (const requiredPath of [
  'README.md',
  'PROJECT_STATUS.md',
  'THIRD_PARTY_NOTICES.md',
  'ASSET_PROVENANCE.md',
  'package-lock.json',
  'playwright.config.mjs',
  'wrangler.jsonc',
  '.assetsignore',
  'tests/e2e/app.spec.mjs',
  'css/app.css',
  'js/app.js',
  'vendor/vue.global.prod.js',
  'vendor/tailwind-local.css',
  'vendor/html-to-image.min.js'
]) {
  record(fs.existsSync(projectPath(requiredPath)), `Missing required file: ${requiredPath}`);
}

const inlineScripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)]
  .map(match => match[1])
  .filter(source => source.trim());

record(inlineScripts.length === 0, 'Application JavaScript must stay in js/app.js, not index.html');
for (const [index, source] of inlineScripts.entries()) {
  try {
    new Function(source);
    record(true, `Inline script ${index + 1} is valid`);
  } catch (error) {
    record(false, `Inline script ${index + 1} has invalid syntax: ${error.message}`);
  }
}

try {
  new Function(appScript);
  record(true, 'Application JavaScript is valid');
} catch (error) {
  record(false, `Application JavaScript has invalid syntax: ${error.message}`);
}

let manifest = null;
try {
  manifest = JSON.parse(manifestSource);
  record(true, 'Manifest JSON is valid');
} catch (error) {
  record(false, `Manifest JSON is invalid: ${error.message}`);
}

let packageJson = null;
try {
  packageJson = JSON.parse(packageSource);
  record(true, 'Package JSON is valid');
} catch (error) {
  record(false, `Package JSON is invalid: ${error.message}`);
}

let wrangler = null;
try {
  wrangler = JSON.parse(wranglerSource);
  record(true, 'Wrangler JSONC is valid JSON');
} catch (error) {
  record(false, `Wrangler JSONC is invalid: ${error.message}`);
}

if (wrangler) {
  record(wrangler.name === 'chat', 'Wrangler Worker name must remain chat');
  record(/^\d{4}-\d{2}-\d{2}$/.test(wrangler.compatibility_date ?? ''), 'Wrangler compatibility_date is missing or invalid');
  record(wrangler.assets?.directory === '.', 'Wrangler static asset directory must remain the project root');
  record(wrangler.assets?.not_found_handling === 'single-page-application', 'Wrangler must use SPA not-found handling');
}

for (const requiredIgnore of ['node_modules/', '.git/', 'tests/', 'scripts/', 'package.json', 'wrangler.jsonc']) {
  record(assetsIgnore.split(/\r?\n/).includes(requiredIgnore), `.assetsignore must exclude ${requiredIgnore}`);
}

if (packageJson) {
  record(packageJson.scripts?.test?.includes('test:e2e'), 'npm test must include the Playwright regression suite');
  record(packageJson.scripts?.['test:e2e'] === 'playwright test', 'Missing test:e2e Playwright script');
  record(Boolean(packageJson.devDependencies?.['@playwright/test']), 'Missing @playwright/test development dependency');
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

const cssReferences = [...appCss.matchAll(/url\(["']?([^"')]+)["']?\)/g)]
  .map(match => match[1])
  .filter(reference => !/^(?:data:|https?:|#)/i.test(reference));

for (const reference of new Set(cssReferences)) {
  record(fs.existsSync(path.resolve(root, 'css', reference)), `CSS references a missing file: ${reference}`);
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

record(/STATE_STORAGE_KEY\s*=\s*['"]wechat_editor_state_v19['"]/.test(applicationSource), 'Expected current localStorage key wechat_editor_state_v19 was not found');
record(/LEGACY_STATE_STORAGE_KEY\s*=\s*['"]wechat_editor_state_v18['"]/.test(applicationSource), 'Expected legacy v18 migration key was not found');
record(/CURRENT_STATE_SCHEMA\s*=\s*2/.test(applicationSource), 'Expected state schema version 2 was not found');
record(/wechat-screenshot-pwa-v\d+/.test(serviceWorker), 'Versioned PWA cache name was not found');
record(/pixelRatio:\s*3/.test(applicationSource), 'Expected 3x PNG export configuration was not found');
record(/async\s+downloadGeneratedImage\s*\(/.test(applicationSource), 'Unified generated-image download action was not found');
record(/async\s+shareGeneratedImage\s*\(/.test(applicationSource), 'Unified generated-image share action was not found');
record(/data-testid=["']generated-image-preview["']/.test(html), 'Generated-image preview test hook was not found');
record(!/async\s+generateImage\s*\(/.test(applicationSource), 'Deprecated duplicate image-generation pipeline is still present');
record(!/shareOrDownloadImage\s*\(/.test(applicationSource), 'Deprecated share-or-download fallback is still present');
record(/activePage:\s*['"]home['"]/.test(applicationSource), 'Expected home page initial state was not found');

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
