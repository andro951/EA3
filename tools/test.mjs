/** Enumerate test paths explicitly so Windows cmd and Unix shells run the same suite. */
import {readdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve,dirname} from 'node:path';
import {spawnSync} from 'node:child_process';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const paths=(await readdir(resolve(root,'tests'))).filter(n=>n.endsWith('.test.mjs')).sort().map(n=>resolve(root,'tests',n));
if(!paths.length)throw Error('No test files were found.');
const result=spawnSync(process.execPath,['--test',...paths],{cwd:root,stdio:'inherit'});
if(result.error)throw result.error;process.exitCode=result.status??1;
