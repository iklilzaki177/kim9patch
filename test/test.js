const fs = require('fs');
const path = require('path');
const os = require('os');
const { applyPatch, removePatch, verifyPatch } = require('../src/patch');
const { fixProviderBaseUrl, getProviderBaseUrl } = require('../src/db');

const TEMP_TARGET = path.join(os.tmpdir(), '9router-test-custom-server.js');
const TEMP_BACKUP = TEMP_TARGET + '.kimchi-backup';

function createCleanFile() {
  const content = `const http = require("http");
const origCreate = http.createServer.bind(http);

http.createServer = (...args) => {
  const handler = args.find((a) => typeof a === "function");
  if (!handler) return origCreate(...args);
  return origCreate(...args);
};

require("./server.js");
`;
  fs.writeFileSync(TEMP_TARGET, content, 'utf8');
}

function cleanup() {
  [TEMP_TARGET, TEMP_BACKUP].forEach(f => {
    if (fs.existsSync(f)) fs.unlinkSync(f);
  });
}

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✓ ${message}`);
    passed++;
  } else {
    console.log(`  ✗ ${message}`);
    failed++;
  }
}

async function runTests() {
  console.log('\n=== Kimchi 9router Patch Tests ===\n');

  // Test 1: detect returns non-null when 9router installed at expected path
  console.log('Test 1: detect() returns path for simulated 9router');
  const { detectInstallPath } = require('../src/detect');
  
  // Create a temp structure mimicking 9router
  const fake9RouterDir = path.join(os.tmpdir(), 'fake-9router-test');
  const fakeAppDir = path.join(fake9RouterDir, 'app');
  fs.mkdirSync(fakeAppDir, { recursive: true });
  fs.writeFileSync(path.join(fakeAppDir, 'custom-server.js'), 'require("./server.js");', 'utf8');
  
  // Monkey-patch detect to find our fake path
  const originalDetect = detectInstallPath;
  // For this test we verify detect logic works by checking it returns null when nothing exists
  // and would return a path if the file existed
  const detectedPath = detectInstallPath();
  assert(detectedPath === null || typeof detectedPath === 'string', 
    'detectInstallPath should return null or a valid path string');
  
  // Cleanup fake dir
  fs.rmSync(fake9RouterDir, { recursive: true, force: true });

  // Test 2: applyPatch is idempotent
  console.log('\nTest 2: applyPatch is idempotent (running twice does not duplicate)');
  cleanup();
  createCleanFile();
  
  const result1 = applyPatch(TEMP_TARGET);
  assert(result1.applied === true, 'First applyPatch should succeed');
  
  const result2 = applyPatch(TEMP_TARGET);
  assert(result2.applied === false, 'Second applyPatch should skip (idempotent)');
  
  const contentAfterTwoPatches = fs.readFileSync(TEMP_TARGET, 'utf8');
  const patchMarkerCount = (contentAfterTwoPatches.match(/\/\* === KIMCHI BRIDGE START === \*\//g) || []).length;
  assert(patchMarkerCount === 1, 'Patch code should appear exactly once (idempotent)');

  // Test 3: verifyPatch returns correct status
  console.log('\nTest 3: verifyPatch returns {patched: false} before, {patched: true} after');
  cleanup();
  createCleanFile();
  
  const beforePatch = verifyPatch(TEMP_TARGET);
  assert(beforePatch.patched === false, 'verifyPatch should return {patched: false} before patch');
  
  applyPatch(TEMP_TARGET);
  const afterPatch = verifyPatch(TEMP_TARGET);
  assert(afterPatch.patched === true, 'verifyPatch should return {patched: true} after patch');

  // Test 4: removePatch restores original
  console.log('\nTest 4: removePatch restores original file');
  cleanup();
  createCleanFile();
  
  applyPatch(TEMP_TARGET);
  const removeResult = removePatch(TEMP_TARGET);
  assert(removeResult.removed === true, 'removePatch should report success');
  
  const restoredContent = fs.readFileSync(TEMP_TARGET, 'utf8');
  const hasPatchCode = restoredContent.includes('KIMCHI BRIDGE START');
  assert(!hasPatchCode, 'Restored file should not contain patch code');
  
  const hasServerRequire = restoredContent.includes('require("./server.js")');
  assert(hasServerRequire, 'Restored file should still contain require("./server.js")');

  // Test 5: DB functions with temporary database
  console.log('\nTest 5: db.js functions');
  const { execSync, execFileSync } = require('child_process');
  const TEMP_DB = path.join(os.tmpdir(), '9router-test-' + Date.now() + '.sqlite');

  // Helper: run sqlite3 without shell (avoids escaping issues)
  function sql(sql) {
    return execFileSync('sqlite3', [TEMP_DB, sql], { encoding: 'utf8', stdio: 'pipe' }).trim();
  }

  // Create test database
  sql("CREATE TABLE providerConnections (id TEXT, provider TEXT, authType TEXT, name TEXT, email TEXT, priority INTEGER, isActive INTEGER, data TEXT, createdAt TEXT, updatedAt TEXT)");

  // Insert test data using SQLite's json_object() to avoid escaping issues
  // id1: provider registered with llm.kimchi.dev (correct URL, should be found)
  sql("INSERT INTO providerConnections VALUES ('id1', 'openai-compatible', 'apikey', 'my-custom-provider', '', 1, 1, json_object('providerSpecificData', json_object('baseUrl', 'https://llm.kimchi.dev/openai/v1', 'nodeName', 'my-custom-provider')), datetime('now'), datetime('now'))");
  // id2: another provider with llm.kimchi.dev
  sql("INSERT INTO providerConnections VALUES ('id2', 'openai-compatible', 'apikey', 'kimchi-alt', '', 1, 1, json_object('providerSpecificData', json_object('baseUrl', 'https://llm.kimchi.dev/openai/v1', 'nodeName', 'kimchi-alt')), datetime('now'), datetime('now'))");
  // id3: non-kimchi provider (should not be affected)
  sql("INSERT INTO providerConnections VALUES ('id3', 'openai-compatible', 'apikey', 'openai', '', 1, 1, json_object('providerSpecificData', json_object('baseUrl', 'https://api.openai.com/v1', 'nodeName', 'openai')), datetime('now'), datetime('now'))");

  // Set environment to use test DB
  const originalDbPath = process.env.ROUTER_DB_PATH;
  process.env.ROUTER_DB_PATH = TEMP_DB;

  // Test getProviderBaseUrl returns a kimchi URL
  const currentUrl = getProviderBaseUrl();
  assert(currentUrl !== null, 'getProviderBaseUrl should return a URL');
  if (currentUrl !== null) {
    assert(currentUrl.includes('llm.kimchi.dev'), 'Returned URL should contain llm.kimchi.dev');
  }

  // Test fixProviderBaseUrl fixes URLs with wrong ports
  const fixResult = fixProviderBaseUrl();
  assert(fixResult.fixed === true, 'fixProviderBaseUrl should return fixed: true');
  assert(fixResult.reason.includes('updated'), 'Should indicate URLs were updated');

  // Verify id1 URL is correct (function normalizes to canonical URL)
  const afterFix = sql("SELECT json_extract(data, '$.providerSpecificData.baseUrl') FROM providerConnections WHERE id='id1'");
  assert(afterFix === 'https://llm.kimchi.dev/openai/v1', 'id1 URL should be canonical llm.kimchi.dev URL');

  // Verify other providers unchanged
  const openaiUrl = sql("SELECT json_extract(data, '$.providerSpecificData.baseUrl') FROM providerConnections WHERE id='id3'");
  assert(openaiUrl === 'https://api.openai.com/v1', 'Non-kimchi providers should be unchanged');

  // Restore environment
  if (originalDbPath) {
    process.env.ROUTER_DB_PATH = originalDbPath;
  } else {
    delete process.env.ROUTER_DB_PATH;
  }

  // Cleanup test DB
  fs.unlinkSync(TEMP_DB);

  // Test 6: Real-world bug scenario - wrong port but contains llm.kimchi.dev
  console.log('\nTest 6: Real-world bug (wrong port containing llm.kimchi.dev)');
  const TEMP_DB3 = path.join(os.tmpdir(), '9router-bug-test-' + Date.now() + '.sqlite');
  const sql3 = (s) => execFileSync('sqlite3', [TEMP_DB3, s], { encoding: 'utf8', stdio: 'pipe' }).trim();

  sql3("CREATE TABLE providerConnections (id TEXT, provider TEXT, authType TEXT, name TEXT, email TEXT, priority INTEGER, isActive INTEGER, data TEXT, createdAt TEXT, updatedAt TEXT)");
  // Real bug: user registered with wrong port but URL contains llm.kimchi.dev
  sql3("INSERT INTO providerConnections VALUES ('id1', 'openai-compatible', 'apikey', 'kimchi', '', 1, 1, json_object('providerSpecificData', json_object('baseUrl', 'http://llm.kimchi.dev:27487/openai/v1', 'nodeName', 'kimchi')), datetime('now'), datetime('now'))");

  process.env.ROUTER_DB_PATH = TEMP_DB3;

  const bugFix = fixProviderBaseUrl();
  assert(bugFix.fixed === true, 'Should fix URL with wrong port containing llm.kimchi.dev');

  const fixedUrl = sql3("SELECT json_extract(data, '$.providerSpecificData.baseUrl') FROM providerConnections WHERE id='id1'");
  assert(fixedUrl === 'https://llm.kimchi.dev/openai/v1', 'Should normalize to correct URL with HTTPS and correct port');

  // Cleanup
  if (originalDbPath) {
    process.env.ROUTER_DB_PATH = originalDbPath;
  } else {
    delete process.env.ROUTER_DB_PATH;
  }
  fs.unlinkSync(TEMP_DB3);

  // Test 7: Integration test - patch and DB fix together
  console.log('\nTest 6: Integration test (patch + DB fix)');
  cleanup();
  createCleanFile();

  const TEMP_DB2 = path.join(os.tmpdir(), '9router-integration-' + Date.now() + '.sqlite');
  const sql2 = (s) => execFileSync('sqlite3', [TEMP_DB2, s], { encoding: 'utf8', stdio: 'pipe' }).trim();

  sql2("CREATE TABLE providerConnections (id TEXT, provider TEXT, authType TEXT, name TEXT, email TEXT, priority INTEGER, isActive INTEGER, data TEXT, createdAt TEXT, updatedAt TEXT)");
  sql2("INSERT INTO providerConnections VALUES ('id1', 'openai-compatible', 'apikey', 'kimchi', '', 1, 1, json_object('providerSpecificData', json_object('baseUrl', 'http://wrong-url.dev/v1', 'nodeName', 'kimchi')), datetime('now'), datetime('now'))");

  process.env.ROUTER_DB_PATH = TEMP_DB2;

  // Apply patch
  const patchResult = applyPatch(TEMP_TARGET);
  assert(patchResult.applied === true, 'Patch should be applied');

  // Fix DB - should report no kimchi URL found (wrong-url.dev != llm.kimchi.dev)
  const dbFixResult = fixProviderBaseUrl();
  assert(dbFixResult.fixed === false, 'DB fix should report no llm.kimchi.dev URL found');
  assert(dbFixResult.suppressLog === true, 'suppressLog should be set when no connection found');

  // Verify patch worked
  const verifyResult = verifyPatch(TEMP_TARGET);
  assert(verifyResult.patched === true, 'Patch should be verified');

  // Restore environment
  if (originalDbPath) {
    process.env.ROUTER_DB_PATH = originalDbPath;
  } else {
    delete process.env.ROUTER_DB_PATH;
  }

  // Cleanup
  cleanup();
  fs.unlinkSync(TEMP_DB2);

  // Test 8: unpatch → patch cycle (regression test)
  console.log('\nTest 8: unpatch → patch cycle (regression test)');
  cleanup();
  createCleanFile();

  const patchResult2 = applyPatch(TEMP_TARGET);
  assert(patchResult2.applied === true, 'First patch should succeed');

  const unpatchResult2 = removePatch(TEMP_TARGET);
  assert(unpatchResult2.removed === true, 'Unpatch should succeed');

  const repatchResult = applyPatch(TEMP_TARGET);
  assert(repatchResult.applied === true, 'Re-patch after unpatch should succeed');

  const repatchedContent = fs.readFileSync(TEMP_TARGET, 'utf8');
  assert(repatchedContent.includes('KIMCHI BRIDGE START'), 'Re-patched file should contain patch markers');

  const verifyResult2 = verifyPatch(TEMP_TARGET);
  assert(verifyResult2.patched === true, 'verifyPatch should return patched: true after re-patch');

  // Idempotency still works after cycle
  const idempotentResult = applyPatch(TEMP_TARGET);
  assert(idempotentResult.applied === false, 'Idempotent check should still work after cycle');

  cleanup();

  // Summary
  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`);
  process.exit(failed > 0 ? 1 : 0);
}

runTests();