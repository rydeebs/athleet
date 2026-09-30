import {createServer} from 'node:http';
import {stat} from 'node:fs/promises';
const port=4174;
let loadedAt=0,worker;
createServer(async(req,res)=>{
 try{
  const {mtimeMs}=await stat(new URL('./dist/server/index.js',import.meta.url));
  if(mtimeMs!==loadedAt){worker=(await import('./dist/server/index.js?build='+mtimeMs)).default;loadedAt=mtimeMs;}
  const chunks=[];for await(const chunk of req)chunks.push(chunk);const body=Buffer.concat(chunks);
  const response=await worker.fetch(new Request(`http://localhost:${port}${req.url}`,{method:req.method,headers:req.headers,...(req.method==='GET'||req.method==='HEAD'?{}:{body})}),process.env);
  res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));
 }catch{res.writeHead(500);res.end('Server error');}
}).listen(port,'127.0.0.1',()=>console.log(`Athleet preview: http://localhost:${port}`));
