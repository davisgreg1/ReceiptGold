#!/usr/bin/env node

/**
 * Environment Switcher Script
 * Usage: 
 *   npm run env:dev
 *   npm run env:prod
 *   node scripts/switch-env.js production
 */

const fs = require('fs');
const path = require('path');

const environment = process.argv[2] || 'development';
const envFile = `.env.${environment}`;
const targetFile = '.env';

if (!fs.existsSync(envFile)) {
  console.error(`❌ Environment file ${envFile} not found!`);
  process.exit(1);
}

try {
  // Copy environment-specific file to .env
  fs.copyFileSync(envFile, targetFile);
  console.log(`✅ Switched to ${environment} environment`);
  console.log(`📄 Loaded: ${envFile} → ${targetFile}`);
  
  // Show first few lines to verify (without exposing secrets)
  const content = fs.readFileSync(targetFile, 'utf8');
  const lines = content.split('\n').slice(0, 3);
  console.log('📋 Preview:');
  lines.forEach(line => {
    if (line.trim() && !line.startsWith('#')) {
      const [key] = line.split('=');
      console.log(`   ${key}=***`);
    } else if (line.trim()) {
      console.log(`   ${line}`);
    }
  });
  
} catch (error) {
  console.error(`❌ Failed to switch environment: ${error.message}`);
  process.exit(1);
}