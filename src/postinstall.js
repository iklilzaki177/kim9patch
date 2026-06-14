const { detectInstallPath } = require('./detect');
const { applyPatch } = require('./patch');

const installPath = detectInstallPath();
if (!installPath) {
  console.log('[kimchi-9router] 9router tidak ditemukan. Patch di-skip (jalankan manual: npx kimchi-9router patch)');
  process.exit(0);
}

try {
  const result = applyPatch(installPath);
  console.log(`[kimchi-9router] ${result.reason}`);
} catch (err) {
  console.error(`[kimchi-9router] Gagal auto-patch: ${err.message}`);
}
