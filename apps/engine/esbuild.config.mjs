import esbuild from 'esbuild';

await esbuild.build({
  entryPoints: ['src/app.ts'],
  bundle: true,
  platform: 'node',
  outfile: 'build/app.js',
  define: { 'process.env.NODE_ENV': '"production"' },
  // opusscript ships an emscripten module that locates its .wasm relative to
  // __dirname. Bundled, that resolves to build/ where the file does not exist,
  // and the failure surfaces as an unhandled rejection from emscripten's own
  // ready promise - which takes the process down rather than throwing where the
  // caller can catch it.
  external: ['discord.js', 'cpu-features', 'ssh2', 'opusscript'],
});
