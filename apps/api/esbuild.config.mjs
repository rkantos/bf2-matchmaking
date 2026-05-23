import esbuild from 'esbuild';

await esbuild.build({
  entryPoints: ['src/app.ts'],
  bundle: true,
  platform: 'node',
  outfile: 'build/app.js',
  define: { 'process.env.NODE_ENV': '"production"' },
  external: ['ssh2', 'cpu-features'],
});
