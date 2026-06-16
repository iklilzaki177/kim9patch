const { execSync, spawnSync } = require('child_process');
const path = require('path');
const os = require('os');
const fs = require('fs');

function getDbPath() {
  if (process.env.ROUTER_DB_PATH) return process.env.ROUTER_DB_PATH;
  return path.join(os.homedir(), '.9router', 'db', 'data.sqlite');
}

function hasSqlite3() {
  try {
    execSync('which sqlite3', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

// Safe sqlite3 execution — avoids shell injection by passing args as array
function sqlite3(dbPath, sql) {
  const result = spawnSync('sqlite3', [dbPath, sql], {
    encoding: 'utf8', stdio: 'pipe'
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(result.stderr.trim());
  return (result.stdout || '').trim();
}

/**
 * Check current baseUrl for kimchi connection.
 * Identifies Kimchi by TWO criteria: baseUrl contains llm.kimchi.dev AND apiKey starts with castai_
 */
function getProviderBaseUrl() {
  const dbPath = getDbPath();
  if (!fs.existsSync(dbPath) || !hasSqlite3()) return null;

  try {
    const sql = "SELECT json_extract(data, '$.providerSpecificData.baseUrl') FROM providerConnections WHERE json_extract(data, '$.providerSpecificData.baseUrl') LIKE '%llm.kimchi.dev%' AND json_extract(data, '$.apiKey') LIKE 'castai_%'";
    const result = sqlite3(dbPath, sql);
    return result || null;
  } catch {
    return null;
  }
}

/**
 * Clear error state for all kimchi provider connections.
 * Clears errorCode and lastError fields after successful patching.
 * Uses strict dual-criteria match: baseUrl + castai_ apiKey
 */
function clearErrorState() {
  const dbPath = getDbPath();
  if (!fs.existsSync(dbPath) || !hasSqlite3()) return { cleared: false };

  try {
    // Find all kimchi providers (baseUrl + apiKey criteria)
    const findSql = "SELECT id FROM providerConnections WHERE json_extract(data, '$.providerSpecificData.baseUrl') LIKE '%llm.kimchi.dev%' AND json_extract(data, '$.apiKey') LIKE 'castai_%'";
    const ids = sqlite3(dbPath, findSql);

    if (!ids) return { cleared: true, reason: 'no kimchi providers found' };

    // Clear errorCode and lastError for each kimchi provider
    const count = ids.split('\n').length;
    sqlite3(dbPath, "UPDATE providerConnections SET data = json_set(data, '$.errorCode', null) WHERE json_extract(data, '$.providerSpecificData.baseUrl') LIKE '%llm.kimchi.dev%' AND json_extract(data, '$.apiKey') LIKE 'castai_%'");
    sqlite3(dbPath, "UPDATE providerConnections SET data = json_set(data, '$.lastError', null) WHERE json_extract(data, '$.providerSpecificData.baseUrl') LIKE '%llm.kimchi.dev%' AND json_extract(data, '$.apiKey') LIKE 'castai_%'");
    sqlite3(dbPath, "UPDATE providerConnections SET data = json_set(data, '$.lastErrorAt', null) WHERE json_extract(data, '$.providerSpecificData.baseUrl') LIKE '%llm.kimchi.dev%' AND json_extract(data, '$.apiKey') LIKE 'castai_%'");

    return { cleared: true, count };
  } catch (err) {
    return { cleared: false, error: err.message };
  }
}

module.exports = { getProviderBaseUrl, clearErrorState };
