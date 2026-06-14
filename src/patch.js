const fs = require('fs');
const path = require('path');

const HEADER_COMMENT = '/* === KIMCHI BRIDGE START === */';
const FOOTER_COMMENT = '/* === KIMCHI BRIDGE END === */';

const PATCH_CODE = `${HEADER_COMMENT}
(function() {
  var _km9_http = require("http");
  var _km9_https = require("https");

  function isKimchiHost(options) {
    if (typeof options === "string") return options.includes("llm.kimchi.dev");
    if (options && options.hostname) return options.hostname.includes("llm.kimchi.dev");
    if (options && options.host) return options.host.includes("llm.kimchi.dev");
    return false;
  }

  function patchOptions(options) {
    if (!options || typeof options === "string") return options;
    options.headers = options.headers || {};
    options.headers["User-Agent"] = "kimchi/0.1.20";
    delete options.headers["Accept-Encoding"];
    delete options.headers["accept-encoding"];
    return options;
  }

  var _origHttpRequest = _km9_http.request;
  _km9_http.request = function(options, callback) {
    if (isKimchiHost(options)) patchOptions(options);
    return _origHttpRequest(options, callback);
  };

  var _origHttpsRequest = _km9_https.request;
  _km9_https.request = function(options, callback) {
    if (isKimchiHost(options)) patchOptions(options);
    return _origHttpsRequest(options, callback);
  };

  if (globalThis.fetch) {
    var _origFetch = globalThis.fetch;
    globalThis.fetch = function(input, init) {
      var url = typeof input === "string" ? input : input.url || input.href || "";
      if (url.includes("llm.kimchi.dev")) {
        init = init || {};
        init.headers = init.headers || {};
        if (typeof init.headers === "object" && !Array.isArray(init.headers)) {
          var h = new Headers(init.headers);
          h.set("User-Agent", "kimchi/0.1.20");
          h.delete("Accept-Encoding");
          init.headers = h;
        }
      }
      return _origFetch(input, init);
    };
  }

  // Hook undici if available
  try {
    var undici = require("undici");
    if (undici && undici.Agent) {
      var _origRequest = undici.request;
      undici.request = function(url, opts) {
        if (typeof url === "string" && url.includes("llm.kimchi.dev")) {
          opts = opts || {};
          opts.headers = opts.headers || {};
          opts.headers["User-Agent"] = "kimchi/0.1.20";
          delete opts.headers["Accept-Encoding"];
          delete opts.headers["accept-encoding"];
        }
        return _origRequest.call(this, url, opts);
      };
    }
  } catch (e) {
    // undici not available, skip
  }
})();
${FOOTER_COMMENT}
`;

function _backupPath(targetPath) {
  return targetPath + '.kimchi-backup';
}

function applyPatch(targetPath) {
  if (!fs.existsSync(targetPath)) {
    throw new Error(`Target file tidak ditemukan: ${targetPath}`);
  }

  const originalContent = fs.readFileSync(targetPath, 'utf8');

  // Idempotent: kalau sudah dipatch, skip
  if (originalContent.includes(HEADER_COMMENT)) {
    return { applied: false, reason: 'patch sudah terpasang (idempotent)' };
  }

  // Backup original
  const backup = _backupPath(targetPath);
  if (!fs.existsSync(backup)) {
    fs.copyFileSync(targetPath, backup);
  }

  // Inject sebelum require('./server.js') atau di akhir file
  const requireLine = `require("./server.js")`;
  const requireLineSingle = `require('./server.js')`;
  let newContent;

  if (originalContent.includes(requireLine)) {
    newContent = originalContent.replace(requireLine, PATCH_CODE + '\n' + requireLine);
  } else if (originalContent.includes(requireLineSingle)) {
    newContent = originalContent.replace(requireLineSingle, PATCH_CODE + '\n' + requireLineSingle);
  } else {
    // fallback: append di akhir
    newContent = originalContent + '\n' + PATCH_CODE;
  }

  fs.writeFileSync(targetPath, newContent, 'utf8');
  return { applied: true, reason: 'patch berhasil diterapkan' };
}

function removePatch(targetPath) {
  if (!fs.existsSync(targetPath)) {
    throw new Error(`Target file tidak ditemukan: ${targetPath}`);
  }

  const backup = _backupPath(targetPath);
  if (fs.existsSync(backup)) {
    fs.copyFileSync(backup, targetPath);
    return { removed: true, reason: 'file dikembalikan dari backup' };
  }

  // Fallback: strip patch code kalau backup hilang
  const content = fs.readFileSync(targetPath, 'utf8');
  if (!content.includes(HEADER_COMMENT)) {
    return { removed: false, reason: 'patch tidak ditemukan di file' };
  }

  const start = content.indexOf(HEADER_COMMENT);
  const end = content.indexOf(FOOTER_COMMENT) + FOOTER_COMMENT.length;
  const newContent = content.slice(0, start) + content.slice(end);
  fs.writeFileSync(targetPath, newContent.trim(), 'utf8');
  return { removed: true, reason: 'patch dicopot via strip (backup tidak tersedia)' };
}

function verifyPatch(targetPath) {
  if (!fs.existsSync(targetPath)) {
    return { patched: false, reason: 'target file tidak ditemukan' };
  }

  const content = fs.readFileSync(targetPath, 'utf8');
  const patched = content.includes(HEADER_COMMENT);
  const backupExists = fs.existsSync(_backupPath(targetPath));
  return { patched, backupExists, version: patched ? 'v2' : null };
}

module.exports = { applyPatch, removePatch, verifyPatch };
