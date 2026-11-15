import { build } from 'esbuild';

await build({
  entryPoints: ['node_modules/@elevenlabs/client/dist/platform/web/index.js'],
  bundle: true,
  format: 'esm',
  platform: 'browser',
  target: ['es2022'],
  outfile: 'public/vendor/elevenlabs-client.js',
  minify: true,
  legalComments: 'none',
});

console.log('built public/vendor/elevenlabs-client.js from the ElevenLabs browser entry point');
