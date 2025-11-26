#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const MEDIA_DIR = 'media';
const TARGET_FILE = 'tous-les-fichiers.html';

// Recursively scan directory for all files
function scanDirectory(dir, baseDir = dir) {
  const items = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    
    // Skip hidden folders and common ignores
    if (entry.name.startsWith('.') || entry.name === 'node_modules') {
      continue;
    }
    
    if (entry.isDirectory()) {
      items.push(...scanDirectory(fullPath, baseDir));
    } else if (entry.isFile()) {
      // Store path relative to repo root with forward slashes
      const relativePath = path.relative(process.cwd(), fullPath).replace(/\\/g, '/');
      items.push(relativePath);
    }
  }
  
  return items;
}

// Main execution
try {
  console.log('Scanning media/ folder...');
  const files = scanDirectory(MEDIA_DIR).sort();
  console.log(`Found ${files.length} file(s)`);
  
  // Read the HTML file
  const htmlPath = path.join(process.cwd(), TARGET_FILE);
  let htmlContent = fs.readFileSync(htmlPath, 'utf8');
  
  // Build the new rawPaths array with proper indentation
  const rawPathsArray = files.map(f => `      "${f}"`).join(',\n');
  const newRawPaths = `const rawPaths = [\n${rawPathsArray}\n    ];`;
  
  // Find and replace the rawPaths declaration
  const rawPathsRegex = /const rawPaths = \[[^\]]*\];/s;
  
  if (!rawPathsRegex.test(htmlContent)) {
    console.error('ERROR: Could not find "const rawPaths = [...];" in ' + TARGET_FILE);
    process.exit(1);
  }
  
  htmlContent = htmlContent.replace(rawPathsRegex, newRawPaths);
  
  // Write back
  fs.writeFileSync(htmlPath, htmlContent, 'utf8');
  
  console.log('✓ Updated rawPaths in ' + TARGET_FILE);
  console.log('✓ Done!');
  
} catch (error) {
  console.error('ERROR:', error.message);
  process.exit(1);
}
