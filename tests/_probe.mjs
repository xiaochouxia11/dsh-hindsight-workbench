import { mountClient, text } from './harness.mjs';
const out = text(mountClient({tab:'setup',diagnostics:{value:{endpoint:'x',health:{ok:true,status:'healthy'},banks:[],upstream:{available:false,error:'e'}}}}).render());
console.log('LEN', out.length);
console.log(out.slice(-900));
