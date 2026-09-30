import {createServer} from 'node:http';
import worker from './dist/server/index.js';
const port=4174;
createServer(async(req,res)=>{try{const chunks=[];for await(const chunk of req)chunks.push(chunk);const body=Buffer.concat(chunks);const response=await worker.fetch(new Request(`http://localhost:${port}${req.url}`,{method:req.method,headers:req.headers,...(req.method==='GET'||req.method==='HEAD'?{}:{body})}));res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));}catch{res.writeHead(500);res.end('Server error');}}).listen(port,'127.0.0.1',()=>console.log(`Athleet preview: http://localhost:${port}`));
