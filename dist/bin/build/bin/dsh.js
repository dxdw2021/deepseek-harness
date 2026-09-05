#!/usr/bin/env node

// DeepSeek Harness Single Binary Entry Point
const { join } = require('path');
const { existsSync } = require('fs');

// Determine the application root
const appRoot = join(__dirname, '..');

// Set environment variables
process.env.DSH_HOME = process.env.DSH_HOME || join(require('os').homedir(), '.dsh');
process.env.NODE_PATH = join(appRoot, 'node_modules');

// Import and run the application
require(join(appRoot, 'node_modules', '@deepseek-ai', 'dsh-cli', 'lib', 'bin.js'));
