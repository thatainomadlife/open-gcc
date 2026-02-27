/**
 * Bundle the GCC MCP server into a single file using esbuild.
 *
 * Bundles src/mcp/server.ts + all dependencies (including @modelcontextprotocol/sdk and zod)
 * into dist/mcp/server.js. Zero runtime dependencies for the end user.
 */

import { build } from 'esbuild';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

await build({
  entryPoints: [join(root, 'src/mcp/server.ts')],
  bundle: true,
  platform: 'node',
  target: 'node18',
  format: 'esm',
  outfile: join(root, 'dist/mcp/server.js'),
  external: [],
  banner: {
    js: '// GCC MCP Server — bundled with esbuild\n' +
        'import { createRequire } from "node:module";\n' +
        'const require = createRequire(import.meta.url);\n',
  },
  minify: false,
  sourcemap: false,
  logLevel: 'info',
});
