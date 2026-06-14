#!/usr/bin/env sh
# Kimchi 9router Patch Installer
# Usage: curl -sSL https://raw.githubusercontent.com/iklilzaki177/km9/main/install.sh | bash
#
# Or download and run locally:
#   curl -sSL https://raw.githubusercontent.com/iklilzaki177/km9/main/install.sh -o install.sh
#   chmod +x install.sh && ./install.sh

set -e

REPO_URL="${REPO_URL:-https://github.com/iklilzaki177/kim9patch.git}"
INSTALL_DIR="${HOME}/.km9-patch"

echo "Installing Kimchi 9router Patch..."

# Check npm availability
if ! command -v npm >/dev/null 2>&1; then
    echo "Error: npm is required but not installed."
    echo "Please install Node.js from https://nodejs.org/"
    exit 1
fi

# Clone or update the repo
if [ -d "${INSTALL_DIR}/.git" ]; then
    echo "Updating existing installation..."
    cd "${INSTALL_DIR}" && git pull -q
else
    echo "Cloning repository..."
    git clone -q "${REPO_URL}" "${INSTALL_DIR}"
fi

# Install globally
echo "Installing npm package globally..."
cd "${INSTALL_DIR}" && npm install -g .

# Symlink bin to /usr/local/bin if possible, otherwise use npm link
if [ -w "/usr/local/bin" ]; then
    ln -sf "${INSTALL_DIR}/bin/km9" "/usr/local/bin/km9"
else
    npm link
fi

echo ""
echo "Installation complete!"
echo ""
echo "Usage:"
echo "  km9 patch    - Install Kimchi compatibility bridge into 9router"
echo "  km9 status   - Check patch status"
echo "  km9 unpatch  - Remove the patch"
echo ""
echo "Run 'km9 help' for more information."