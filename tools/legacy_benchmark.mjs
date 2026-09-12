/** Use with a local legacy file. The report contains counts/timing, never source text. */
import {readFile,writeFile} from 'node:fs/promises';
import {basename} from 'node:path';
import {performance} from 'node:perf_hooks';
import {safeJSON} from '../app/core/util.mjs';
import {inspectLegacy} from '../app/migration/convert.mjs';
import {GraphIndex} from '../app/authoring/graph.mjs';
const path=process.argv[2];if(!path)throw new Error('Usage: node --max-old-space-size=1024 tools/legacy_benchmark.mjs /path/to/legacy-story.json [report.json]');
const started=performance.now(),raw=await readFile(path,'utf8'),input=safeJSON(raw),parsed=performance.now(),review=await inspectLegacy(input,{name:basename(path),rawText:raw}),converted=performance.now();
const graphs=review.candidates.filter(c=>c.kind==='story').map(c=>new GraphIndex(c));
const report={sourceName:basename(path),sourceBytes:Buffer.byteLength(raw),sourceHash:review.sourceHash,counts:review.counts,graphNodes:graphs.reduce((n,g)=>n+g.nodes.size,0),visibleCards:graphs.map(g=>g.visible({x:0,y:0,width:1440,height:900,zoom:.7}).nodes.length),parseMs:parsed-started,reviewMs:converted-parsed,graphMs:performance.now()-converted,memory:process.memoryUsage(),limitation:'Source-preserving migration review and graph indexing, not gameplay parity or successful execution of legacy rules.'};
console.log(JSON.stringify(report,null,2));if(process.argv[3])await writeFile(process.argv[3],JSON.stringify(report,null,2));
