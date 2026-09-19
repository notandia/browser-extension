'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const TARGETS = new Set(['chrome', 'edge', 'firefox', 'safari']);
const RUNTIME_DIRECTORIES = new Set(['_locales', 'content', 'icons', 'shared']);
const OMIT_TOP_LEVEL = new Set([
  '.git',
  '.github',
  'dist',
  'docs',
  'node_modules',
  'platforms',
  'scripts',
  'store',
  'tests'
]);
const OMIT_ROOT_FILES = new Set([
  '.gitattributes',
  '.gitignore',
  'package.json',
  'package-lock.json',
  'README.md',
  'SECURITY.md',
  'renovate.json'
]);
const DELETE = Symbol('delete');

function fail(message) {
  throw new Error(`Target build failed: ${message}`);
}

function parseArguments(argv) {
  const args = { target: null, releaseVersion: null };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === '--target') args.target = argv[++index];
    else if (value === '--version') args.releaseVersion = argv[++index];
    else fail(`unknown argument: ${value}`);
  }
  if (!TARGETS.has(args.target)) fail(`unsupported target: ${args.target || '(missing)'}`);
  return args;
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function mergeValue(base, overlay) {
  if (overlay === null) return DELETE;
  if (Array.isArray(overlay)) return overlay.map(value => structuredClone(value));
  if (overlay && typeof overlay === 'object') {
    const result = base && typeof base === 'object' && !Array.isArray(base)
      ? structuredClone(base)
      : {};
    for (const [key, value] of Object.entries(overlay)) {
      const merged = mergeValue(result[key], value);
      if (merged === DELETE) delete result[key];
      else result[key] = merged;
    }
    return result;
  }
  return overlay;
}

function normalizeVersion(input, fallback) {
  const releaseVersion = String(input || fallback || '').replace(/^v/, '');
  const manifestVersion = releaseVersion.split('-', 1)[0];
  if (!/^\d+(?:\.\d+){0,3}$/.test(manifestVersion)) {
    fail(`invalid browser manifest version: ${releaseVersion}`);
  }
  if (releaseVersion && !/^\d+(?:\.\d+){0,3}(?:-[0-9A-Za-z.-]+)?$/.test(releaseVersion)) {
    fail(`invalid release version: ${releaseVersion}`);
  }
  return { releaseVersion, manifestVersion };
}

function shouldOmit(relativePath) {
  const normalized = relativePath.split(path.sep).join('/');
  const [topLevel] = normalized.split('/');
  if (normalized.split('/').some(part => part.startsWith('.'))) return true;
  if (normalized.includes('/') && !RUNTIME_DIRECTORIES.has(topLevel)) return true;
  if (OMIT_TOP_LEVEL.has(topLevel)) return true;
  if (!normalized.includes('/') && OMIT_ROOT_FILES.has(normalized)) return true;
  if (normalized === 'manifest.json') return true;
  return /\.(?:zip|xpi)$/i.test(normalized);
}

function copyRuntimeFiles(sourceDirectory, destinationDirectory, relativeDirectory = '') {
  for (const entry of fs.readdirSync(sourceDirectory, { withFileTypes: true })) {
    const relativePath = path.join(relativeDirectory, entry.name);
    if (!relativeDirectory && entry.isDirectory() && !RUNTIME_DIRECTORIES.has(entry.name)) continue;
    if (shouldOmit(relativePath)) continue;
    const sourcePath = path.join(sourceDirectory, entry.name);
    const destinationPath = path.join(destinationDirectory, relativePath);
    if (entry.isDirectory()) {
      fs.mkdirSync(destinationPath, { recursive: true });
      copyRuntimeFiles(sourcePath, destinationDirectory, relativePath);
    } else if (entry.isFile()) {
      fs.mkdirSync(path.dirname(destinationPath), { recursive: true });
      fs.copyFileSync(sourcePath, destinationPath);
    }
  }
}

function collectTextFiles(directory, predicate, output = []) {
  if (!fs.existsSync(directory)) return output;
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) collectTextFiles(absolutePath, predicate, output);
    else if (entry.isFile() && predicate(absolutePath)) output.push(absolutePath);
  }
  return output;
}

function verifyPolicy(target, destinationDirectory) {
  const policyPath = path.join(ROOT, 'platforms', target, 'policy.json');
  if (!fs.existsSync(policyPath)) return;
  const policy = readJson(policyPath);
  const forbiddenTerms = Array.isArray(policy.forbiddenTerms) ? policy.forbiddenTerms : [];
  if (forbiddenTerms.length === 0) return;

  const packageFiles = collectTextFiles(destinationDirectory, filePath => /\.(?:html|json|md|txt)$/i.test(filePath));
  const storeDirectory = path.join(ROOT, 'store', target);
  const storeFiles = collectTextFiles(storeDirectory, filePath => /\.(?:html|json|md|txt)$/i.test(filePath));
  const violations = [];

  for (const filePath of [...packageFiles, ...storeFiles]) {
    const source = fs.readFileSync(filePath, 'utf8');
    for (const term of forbiddenTerms) {
      if (source.toLocaleLowerCase('en-US').includes(String(term).toLocaleLowerCase('en-US'))) {
        violations.push(`${path.relative(ROOT, filePath)} contains forbidden term ${JSON.stringify(term)}`);
      }
    }
  }

  if (violations.length > 0) fail(`${target} policy violations:\n${violations.join('\n')}`);
}

function verifyManifestFiles(manifest, destinationDirectory) {
  const referencedFiles = new Set();
  if (manifest.background?.service_worker) referencedFiles.add(manifest.background.service_worker);
  for (const backgroundScript of manifest.background?.scripts || []) referencedFiles.add(backgroundScript);
  if (manifest.action?.default_popup) referencedFiles.add(manifest.action.default_popup);
  if (manifest.options_page) referencedFiles.add(manifest.options_page);
  for (const contentScript of manifest.content_scripts || []) {
    for (const file of contentScript.js || []) referencedFiles.add(file);
    for (const file of contentScript.css || []) referencedFiles.add(file);
  }
  for (const relativePath of referencedFiles) {
    if (!fs.existsSync(path.join(destinationDirectory, relativePath))) {
      fail(`manifest references missing file: ${relativePath}`);
    }
  }
}

function buildTarget(target, releaseVersionInput, outputRoot = path.join(ROOT, 'dist')) {
  if (!TARGETS.has(target)) fail(`unsupported target: ${target}`);
  const packageJson = readJson(path.join(ROOT, 'package.json'));
  const baseManifest = readJson(path.join(ROOT, 'manifest.json'));
  const overlay = readJson(path.join(ROOT, 'platforms', target, 'manifest.json'));
  const { releaseVersion, manifestVersion } = normalizeVersion(releaseVersionInput, packageJson.version);
  const manifest = mergeValue(baseManifest, overlay);
  manifest.version = manifestVersion;
  if (releaseVersion !== manifestVersion) manifest.version_name = releaseVersion;
  else delete manifest.version_name;

  const destinationDirectory = path.join(outputRoot, target);
  fs.rmSync(destinationDirectory, { recursive: true, force: true });
  fs.mkdirSync(destinationDirectory, { recursive: true });
  copyRuntimeFiles(ROOT, destinationDirectory);
  fs.writeFileSync(path.join(destinationDirectory, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);

  verifyManifestFiles(manifest, destinationDirectory);
  verifyPolicy(target, destinationDirectory);
  console.log(`Built ${target} extension in ${path.relative(ROOT, destinationDirectory)}`);
  return destinationDirectory;
}

if (require.main === module) {
  const args = parseArguments(process.argv.slice(2));
  buildTarget(args.target, args.releaseVersion);
}

module.exports = { buildTarget, mergeValue, normalizeVersion };
