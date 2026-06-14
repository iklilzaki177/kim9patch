#!/usr/bin/env sh
# Kimchi 9router Patch Installer
# Usage: curl -sSL https://raw.githubusercontent.com/kimchi-dev/9router-patch/main/install.sh | bash
#
# Or download and run locally:
#   curl -sSL https://raw.githubusercontent.com/kimchi-dev/9router-patch/main/install.sh -o install.sh
#   chmod +x install.sh && ./install.sh

set -e

REPO_URL="${REPO_URL:-https://github.com/iklilzaki177/kim9patch.git}"
INSTALL_DIR="${HOME}/.kimchi-9router-patch"

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
    ln -sf "${INSTALL_DIR}/bin/kimchi-9router" "/usr/local/bin/kimchi-9router"
else
    npm link
fi

echo ""
echo "Installation complete!"
echo ""
echo "Usage:"
echo "  kimchi-9router patch    - Install Kimchi compatibility bridge into 9router"
echo "  kimchi-9router status   - Check patch status"
echo "  kimchi-9router unpatch  - Remove the patch"
echo ""
echo "Run 'kimchi-9router help' for more information."