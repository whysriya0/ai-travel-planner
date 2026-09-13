import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {build} from 'rolldown';
import {compile} from '@tailwindcss/node';
import {Scanner} from '@tailwindcss/oxide';
const root=path.resolve(fileURLToPath(new URL('..',import.meta.url)));
export async function buildPreview(){
 const output=path.join(root,'out'); await fs.mkdir(output,{recursive:true});
 await build({input:path.join(root,'scripts/preview-entry.tsx'),cwd:root,platform:'browser',resolve:{alias:{'@':root}},transform:{define:{'process.env.NODE_ENV':'"production"'}},output:{file:path.join(output,'app.js'),format:'esm',minify:true},onwarn(w){if(w.code!=='MODULE_LEVEL_DIRECTIVE')console.warn(w.message)}});
 const css=await fs.readFile(path.join(root,'app/globals.css'),'utf8');
 const result=await compile(css,{base:path.join(root,'app'),onDependency(){}});
 const scanner=new Scanner({sources:[{base:root,pattern:'app/**/*.tsx',negated:false},{base:root,pattern:'components/**/*.tsx',negated:false}]});
 await fs.writeFile(path.join(output,'app.css'),result.build(scanner.scan()));
 await fs.cp(path.join(root,'public'),output,{recursive:true});
 await fs.writeFile(path.join(output,'index.html'),'<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#315c45"><title>Roam — Your travel story</title><meta name="description" content="An immersive travel journal with animated routes, thoughtful chapters and moments worth slowing down for."><link rel="icon" href="/favicon.svg"><link rel="stylesheet" href="/app.css"></head><body><div id="root"></div><script type="module" src="/app.js"></script></body></html>');
 console.log('Preview build complete.');
}
if(process.argv[1]===fileURLToPath(import.meta.url))await buildPreview();

