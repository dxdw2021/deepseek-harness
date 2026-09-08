#!/bin/bash

# DeepSeek Harness Wrapper Script
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(dirname "$SCRIPT_DIR")"

# Set environment variables
export DSH_HOME="${DSH_HOME:-$HOME/.dsh}"
export NODE_PATH="${APP_DIR}/node_modules"

# Run the application
exec node "${APP_DIR}/bin/dsh.js" "$@"
