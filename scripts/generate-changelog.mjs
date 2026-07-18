#!/usr/bin/env node

/**
 * generate-changelog.mjs
 *
 * Generates user-facing release notes for the commits since the last tag.
 * Primary path: the Anthropic API (needs ANTHROPIC_API_KEY). Hard fallback:
 * a mechanical conventional-commit grouping (Features / Fixes / Other), so the
 * release train is never blocked by a missing key or a failed API call.
 *
 * Usage: node scripts/generate-changelog.mjs <version>
 * Output: notes on stdout; logs on stderr.
 */

import { execSync } from 'node:child_process';

const MODEL = 'claude-sonnet-4-6';

const CHANGELOG_PROMPT = `You are a changelog generator for Agentage Galaxy.
Agentage Galaxy is an Obsidian plugin that renders the vault as a 3D, rotating force-graph.

Given the following git commits, generate a concise, user-friendly changelog entry.

Rules:
1. Group changes into these categories (only include categories that have changes):
   - **New Features** - New functionality
   - **Improvements** - Enhancements to existing features
   - **Bug Fixes** - Fixed issues
   - **Performance** - Performance improvements
   - **Documentation** - Doc changes (only if significant)
   - **Infrastructure** - CI/CD, build system changes (only if user-facing)

2. Write from a user's perspective - what does this mean for them?
3. Be concise - one line per change, no unnecessary details
4. Skip internal refactoring or cleanup that doesn't affect users
5. Use present tense ("Add" not "Added")
6. Start each item with a verb (Add, Fix, Improve, Update, etc.)
7. If there are no meaningful user-facing changes, output "No significant changes"

Format your response as markdown bullet points under each category heading.
Do NOT include the version number or date - just the categorized changes.

Example output format:
### New Features
- Add search filter for tag nodes

### Bug Fixes
- Fix camera drift when auto-rotate is enabled

Commits to analyze:
`;

function git(cmd) {
  return execSync(cmd, { encoding: 'utf-8' }).trim();
}

function getCommitsSinceLastTag() {
  let lastTag = '';
  try {
    // Highest semver tag, NOT `git describe`: historical tags live on side
    // branches (not ancestors of master), which makes describe return stale tags.
    lastTag = git("git tag --list '[0-9]*.[0-9]*.[0-9]*' --sort=-v:refname").split('\n')[0] ?? '';
  } catch {
    // no tags yet
  }
  const range = lastTag ? `${lastTag}..HEAD` : 'HEAD';
  console.error(lastTag ? `Commits since tag ${lastTag}:` : 'No tags found, using full history:');
  try {
    return git(`git log ${range} --pretty=format:"%h %s" --no-merges`);
  } catch {
    return '';
  }
}

/** Mechanical fallback: group conventional-commit subjects. Never throws. */
function mechanicalNotes(commits) {
  const subjects = commits
    .split('\n')
    .map((l) => l.replace(/^[0-9a-f]+ /, '').trim())
    .filter(Boolean)
    .filter((s) => !/^chore\(release\)/.test(s))
    .filter((s) => !/^\d+\.\d+\.\d+/.test(s));
  const feats = subjects.filter((s) => /^feat(\([^)]*\))?!?:/.test(s));
  const fixes = subjects.filter((s) => /^fix(\([^)]*\))?!?:/.test(s));
  const others = subjects.filter(
    (s) => !/^(feat|fix|docs|chore|ci)(\([^)]*\))?!?:/.test(s)
  );
  const section = (title, items) =>
    items.length ? `### ${title}\n${items.map((s) => `- ${s}`).join('\n')}\n` : '';
  const out = [
    section('New Features', feats),
    section('Bug Fixes', fixes),
    section('Other', others),
  ]
    .filter(Boolean)
    .join('\n')
    .trim();
  return out || 'No significant changes';
}

async function claudeNotes(commits) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 1024,
      messages: [{ role: 'user', content: CHANGELOG_PROMPT + '\n```\n' + commits + '\n```' }],
    }),
  });
  if (!res.ok) {
    throw new Error(`Anthropic API ${res.status}: ${(await res.text()).slice(0, 200)}`);
  }
  const data = await res.json();
  const text = (data.content ?? [])
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('\n')
    .trim();
  if (!text) throw new Error('Anthropic API returned empty content');
  return text;
}

async function main() {
  const version = process.argv[2];
  if (!version) {
    console.error('Usage: node scripts/generate-changelog.mjs <version>');
    process.exit(1);
  }

  const commits = getCommitsSinceLastTag();
  if (!commits) {
    console.log('No significant changes');
    return;
  }
  console.error(commits);
  console.error('');

  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('ANTHROPIC_API_KEY not set - using mechanical fallback notes.');
    console.log(mechanicalNotes(commits));
    return;
  }

  try {
    console.error(`Calling Anthropic API (${MODEL})...`);
    console.log(await claudeNotes(commits));
  } catch (err) {
    console.error(`Claude generation failed (${err.message}) - using mechanical fallback notes.`);
    console.log(mechanicalNotes(commits));
  }
}

main();
