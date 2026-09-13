import { build } from 'rolldown';
import path from 'node:path';
import fs from 'node:fs/promises';
export async function buildBackend() {
  await fs.mkdir('work', {recursive:true});
  await build({input:'lib/api.ts', platform:'node', resolve:{alias:{'@':path.resolve('.')}}, output:{file:'work/local-api.mjs', format:'esm'}});
}
