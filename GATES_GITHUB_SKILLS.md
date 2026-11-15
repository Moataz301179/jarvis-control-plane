# Gates: GitHub skill installation

OWNS: scripts/install-github-skills.mjs, scripts/verify-installed-skills.mjs, server.js, package.json

Scope: Install all 193 skills from the pinned Hatchable skill sources into the Hermes default profile, make them discoverable, update JARVIS database state, and verify physical files, Hermes discovery and database status.

- [x] G1: Source checks pass
  CHECK: npm run check
  EXPECT: node --check lib/github-repos.js
  EVIDENCE: automatic-evidence=v1; definition-sha256=033c09c0bbfe972d07c3e6a0fdcf053b515b74b554c82166c5bcd86d1d55006e; exit=0; EXPECT=matched; output-sha256=a84bf4c017c057c76f7170826339c3a88b81b55d524456c6c6bf1fcd467dda1e; output-bytes=396; shell=/bin/sh; cwd=/Users/Moatazi/Documents/ChatGPT/Jarvis; path=78c5d8f93c1a/31 entries

- [x] G2: All 193 skills are physically present, discovered by Hermes, and installed in JARVIS
  CHECK: node scripts/verify-installed-skills.mjs
  EXPECT: github skills verified files=193 hermes=193 database=193 repositories=6
  EVIDENCE: automatic-evidence=v1; definition-sha256=f413a9e76544870c1f48a9d00e6576754d23f18a0476355da6efcecbc4219214; exit=0; EXPECT=matched; output-sha256=4da70294ab081206cd537f46b0e56e2f89fe1c07d5b9e85568af6603608b4830; output-bytes=72; shell=/bin/sh; cwd=/Users/Moatazi/Documents/ChatGPT/Jarvis; path=78c5d8f93c1a/31 entries
