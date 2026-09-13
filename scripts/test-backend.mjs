import {build} from 'rolldown';
await build({input:'tests/backend.test.ts',platform:'node',output:{file:'work/backend-tests.mjs',format:'esm'}});
await import('../work/backend-tests.mjs');
