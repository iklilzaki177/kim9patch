const { detectInstallPath } = require('./detect');
const { applyPatch, removePatch, verifyPatch } = require('./patch');

module.exports = {
  detectInstallPath,
  applyPatch,
  removePatch,
  verifyPatch,
};
