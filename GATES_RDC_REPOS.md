# Gates: Remote Desktop, Cursor and Hatchable repository inventory

OWNS: server.js, operations-loop.js, mac-bridge/bridge.js, migrations/014_venture_repository_registry.sql, public/app.js, package.json, scripts/verify-rdc-repos.mjs

Scope: Link JARVIS to the Remote Desktop Commander device, add controlled Cursor desktop actions, import the Hatchable Venture Studio repository registry, expose it in the UI, and reduce false Mac offline notifications.

- [x] G1: Source and control-plane checks pass
  CHECK: npm run check && npm test
  EXPECT: # pass 2
  EVIDENCE: automatic-evidence=v1; definition-sha256=246d4f5f19aa8a268878fdf475cad837982931e4aea9c6c66fce49625d8f715b; exit=0; EXPECT=matched; output-sha256=52b05619285faf758a42ed9561685dff36379d8eba477337bee25e6476e4be43; output-bytes=918; shell=/bin/sh; cwd=/Users/Moatazi/Documents/ChatGPT/Jarvis; path=78c5d8f93c1a/31 entries

- [x] G2: The deployed registry, Remote Desktop identity and Mac bridge alert state verify end to end
  CHECK: node scripts/verify-rdc-repos.mjs
  EXPECT: rdc repository integration verified
  EVIDENCE: automatic-evidence=v1; definition-sha256=ac60e39f4e0ec66de3f59d158b194140287443598746a1e83b344097fadb7507; exit=0; EXPECT=matched; output-sha256=b2ba777dcee502cd7c6504af321e80580751625ab5cecc217cb323adfef3f7f3; output-bytes=97; shell=/bin/sh; cwd=/Users/Moatazi/Documents/ChatGPT/Jarvis; path=78c5d8f93c1a/31 entries
