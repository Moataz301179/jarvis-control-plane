# Gates: Hermes execution bridge and shared memory

OWNS: server.js, lib/auth.js, lib/config.js, migrations/013_hermes_shared_memory.sql, hermes-bridge/**, deploy/com.moatazi.jarvis-hermes-bridge.plist, scripts/verify-hermes-live.mjs, scripts/verify-memory-live.mjs, public/app.js, package.json

Scope: Connect JARVIS to the local Hermes execution gateway through an authenticated Mac-side bridge, add project-scoped shared memory with agent permissions, expose the controls in the interface, and verify a real mission and memory round trip.

- [x] G1: Source checks and control-plane tests pass
  CHECK: npm run check && npm test
  EXPECT: # pass 2
  EVIDENCE: automatic-evidence=v1; definition-sha256=246d4f5f19aa8a268878fdf475cad837982931e4aea9c6c66fce49625d8f715b; exit=0; EXPECT=matched; output-sha256=e9acdf3822e5b6c712ec024388ee0b51138003dac084602b69bf88a52a347270; output-bytes=884; shell=/bin/sh; cwd=/Users/Moatazi/Documents/ChatGPT/Jarvis; path=78c5d8f93c1a/31 entries

- [x] G2: The deployed system stores and retrieves project-scoped memory
  CHECK: node scripts/verify-memory-live.mjs
  EXPECT: project memory verified
  EVIDENCE: automatic-evidence=v1; definition-sha256=ba337c367b819425997f300c8aba1360cdec1d5ef32ab6224483c7b7a513ab07; exit=0; EXPECT=matched; output-sha256=65f16decb8bae85540f814204521eec4ffb6cc96b4e31420e7740a94fcb362ba; output-bytes=85; shell=/bin/sh; cwd=/Users/Moatazi/Documents/ChatGPT/Jarvis; path=78c5d8f93c1a/31 entries

- [x] G3: The live Hermes bridge executes a real queued mission and returns its result to JARVIS
  CHECK: node scripts/verify-hermes-live.mjs
  EXPECT: hermes integration verified
  EVIDENCE: automatic-evidence=v1; definition-sha256=9758b7f649a0013043ca22ac06ec55582ec16d751f2acc074137c44f090eab12; exit=0; EXPECT=matched; output-sha256=af3f02d4b0bb118214506460e5e3f95b2824044dd5aa851f75bb700386adb5f2; output-bytes=129; shell=/bin/sh; cwd=/Users/Moatazi/Documents/ChatGPT/Jarvis; path=78c5d8f93c1a/31 entries
