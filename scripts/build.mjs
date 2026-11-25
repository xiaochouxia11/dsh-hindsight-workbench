import { mkdir, copyFile, readFile, writeFile } from 'node:fs/promises';
import vm from 'node:vm';
await mkdir('dist',{recursive:true});
const client=await readFile('src/client.js','utf8');
new vm.Script(client);
for(const file of ['index.js','client.js'])await copyFile('src/'+file,'dist/'+file);
await writeFile('dist/build.json',JSON.stringify({format:1,entries:['index.js','client.js'],dependencies:[],clientFormat:'DSH lazy factory'},null,2)+'\n');
console.log('Built self-contained host ESM and DSH client lazy factory.');
