# Gates: JARVIS capability review and GitHub execution

OWNS: server.js**, lib/**, public/**, migrations/**, scripts/**, package.json, package-lock.json

Scope: Verify JARVIS runtime capabilities, add real Chromium browsing and isolated public GitHub repository installation, import the complete Hatchable skill catalogue, deploy the verified release, and measure the running production capabilities.

- [x] G1: Source syntax and existing control-plane tests pass
  CHECK: npm run check && npm test
  EXPECT: # pass 2
  EVIDENCE: automatic-evidence=v1; definition-sha256=246d4f5f19aa8a268878fdf475cad837982931e4aea9c6c66fce49625d8f715b; exit=0; EXPECT=matched; output-sha256=90253940b1fda2eb73e5f3a3598a6374196a2b9142b1287719cedafaa6902b2f; output-bytes=842; shell=/bin/sh; cwd=/Users/Moatazi/Documents/ChatGPT/Jarvis; path=78c5d8f93c1a/31 entries

- [x] G2: The GitHub installer performs a real public clone and verifies remote identity
  CHECK: node scripts/verify-github-installer.mjs
  EXPECT: github installer verified
  EVIDENCE: automatic-evidence=v1; definition-sha256=568c24f9cd167b159728736370ed732353bc6373eff32938384660c130b4dd4e; exit=0; EXPECT=matched; output-sha256=ac270326853fdbfa18c66cebdf998171040af2716283fdf621436b2cb1403cb7; output-bytes=59; shell=/bin/sh; cwd=/Users/Moatazi/Documents/ChatGPT/Jarvis; path=78c5d8f93c1a/31 entries

- [x] G3: The source skill catalogue contains exactly 17 sources, 32 tools and 193 skills with complete identities
  CHECK: node scripts/verify-capability-source.mjs
  EXPECT: capability source verified: 17 sources, 32 tools, 193 skills
  EVIDENCE: automatic-evidence=v1; definition-sha256=a77e1c804d3ec3bc3be6e82d47181cc6aa8f550c3fe70a4ea0e2b5ae86dfba42; exit=0; EXPECT=matched; output-sha256=67461c6ccde094a40d526aa79e63e526228c7148d7cb95e5953a9e287af57ec5; output-bytes=61; shell=/bin/sh; cwd=/Users/Moatazi/Documents/ChatGPT/Jarvis; path=78c5d8f93c1a/31 entries

- [x] G4: The deployed VPS verifies all five JARVIS services, live Chromium browsing, GitHub execution and the imported 193-skill catalogue
  CHECK: node scripts/verify-live-capabilities.mjs
  EXPECT: live capabilities verified
  EVIDENCE: automatic-evidence=v1; definition-sha256=d2611f4d7ad21f122e1c965270a39cfd9bbcdc42a71d1775ef07a47530f33dd8; exit=0; EXPECT=matched; output-sha256=a29f8251c367a16eed6624db0efa5eea1dca49ff1c960bf358b9bf14f0091dc1; output-bytes=98; shell=/bin/sh; cwd=/Users/Moatazi/Documents/ChatGPT/Jarvis; path=78c5d8f93c1a/31 entries
