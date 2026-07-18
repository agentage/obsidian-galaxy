#!/usr/bin/env node

/**
 * update-changelog.mjs
 *
 * Inserts (or replaces) a version entry in CHANGELOG.md.
 *
 * Usage: node scripts/update-changelog.mjs <version> [changelog-content]
 * If changelog-content is not provided, reads from stdin.
 * Entries are `## [version] - YYYY-MM-DD` under the header's `---` divider.
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const changelogPath = join(dirname(fileURLToPath(import.meta.url)), '..', 'CHANGELOG.md');

function getToday() {
  return new Date().toISOString().slice(0, 10);
}

function initialChangelog() {
  return `# Changelog

All notable changes to Agentage Galaxy will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

`;
}

function insertEntry(version, content) {
  const changelog = existsSync(changelogPath)
    ? readFileSync(changelogPath, 'utf-8')
    : initialChangelog();
  const newEntry = `## [${version}] - ${getToday()}\n\n${content}\n\n`;
  const escaped = version.replace(/\./g, '\\.');

  if (new RegExp(`^## \\[${escaped}\\]`, 'm').test(changelog)) {
    console.error(`Version ${version} already exists in CHANGELOG.md - replacing entry.`);
    const entryPattern = new RegExp(`## \\[${escaped}\\][^]*?(?=## \\[|$)`, 'm');
    writeFileSync(changelogPath, changelog.replace(entryPattern, newEntry));
    return;
  }

  const headerMatch = changelog.match(/^# Changelog[\s\S]*?Semantic Versioning[^\n]*\n+---\n/m);
  if (headerMatch) {
    const at = headerMatch.index + headerMatch[0].length;
    writeFileSync(
      changelogPath,
      changelog.slice(0, at) + '\n' + newEntry + changelog.slice(at).replace(/^\n+/, '')
    );
    return;
  }

  const firstEntry = changelog.match(/^## \[/m);
  if (firstEntry) {
    writeFileSync(
      changelogPath,
      changelog.slice(0, firstEntry.index) + newEntry + changelog.slice(firstEntry.index)
    );
  } else {
    writeFileSync(changelogPath, changelog + '\n' + newEntry);
  }
}

async function readStdin() {
  if (process.stdin.isTTY) return '';
  let data = '';
  process.stdin.setEncoding('utf-8');
  for await (const chunk of process.stdin) data += chunk;
  return data.trim();
}

async function main() {
  const version = process.argv[2];
  let content = process.argv[3];

  if (!version) {
    console.error('Usage: node scripts/update-changelog.mjs <version> [changelog-content]');
    process.exit(1);
  }
  if (!content) content = await readStdin();
  if (!content) {
    console.error('Error: no changelog content provided (argument or stdin).');
    process.exit(1);
  }

  insertEntry(version, content);
  console.error(`Updated CHANGELOG.md with version ${version} (${getToday()}).`);
}

main().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
