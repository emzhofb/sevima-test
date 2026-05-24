#!/usr/bin/env node
import { readFileSync } from 'fs';
import { parse } from './parser.js';

const filePath = process.argv[2];
if (!filePath) {
  console.error('Usage: flowforge-validate <path>');
  process.exit(2);
}

try {
  const content = readFileSync(filePath, 'utf-8');
  const result = parse(content);

  if (result.ok) {
    console.log('✓ Valid workflow');
    console.log('Topological order:', result.sorted.join(' → '));
    process.exit(0);
  } else {
    console.error('✗ Invalid workflow:');
    for (const err of result.errors) {
      console.error(`  - [${err.issue}] ${err.step_id ?? '<root>'}: ${err.message}`);
    }
    process.exit(1);
  }
} catch (err) {
  console.error(`Error reading file: ${(err as Error).message}`);
  process.exit(3);
}
