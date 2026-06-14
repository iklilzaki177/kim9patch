const { detectInstallPath } = require('./detect');
const { applyPatch } = require('./patch');

const installPath = detectInstallPath();
if (!installPath) {
  console.log('[km9] 9router tidak ditemukan. Patch di-skip (jalankan manual: npx km9 patch)');
  process.exit(0);
}

try {
  const result = applyPatch(installPath);
  console.log(`[km9] ${result.reason}`);
} catch (err) {
  console.error(`[km9] Gagal auto-patch: ${err.message}`);
}
