import http from 'node:http';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root=fileURLToPath(new URL('../dist/',import.meta.url));
const host=process.argv.includes('--lan')?'0.0.0.0':'127.0.0.1';
const port=Number(process.env.PORT||4174);
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.json':'application/json','.txt':'text/plain; charset=utf-8'};
try{await stat(path.join(root,'index.html'));}catch{console.error('Build the game first: npm ci && npm run build');process.exit(1);}
const server=http.createServer(async(req,res)=>{
  try{
    if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);res.end('Method not allowed');return;}
    const url=new URL(req.url,'http://localhost');
    if(url.pathname==='/__skyway_health'){res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify({app:'monster-skyway',version:'0.1.0'}));return;}
    const pathname=decodeURIComponent(url.pathname);
    let file=path.resolve(root,`.${pathname}`);
    if(file!==path.resolve(root)&&!file.startsWith(root)){res.writeHead(403);res.end('Forbidden');return;}
    let info=await stat(file);
    if(info.isDirectory()){file=path.join(file,'index.html');info=await stat(file);}
    if(!info.isFile()){res.writeHead(404);res.end('Not found');return;}
    res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','Content-Length':info.size,'X-Content-Type-Options':'nosniff','Cache-Control':'no-cache'});
    if(req.method==='HEAD'){res.end();return;}
    const stream=createReadStream(file);stream.on('error',()=>res.destroy());stream.pipe(res);
  }catch(error){res.writeHead(error.code==='ENOENT'?404:400);res.end('Not found');}
});
server.on('error',error=>{console.error(`Could not start the game: ${error.message}`);process.exitCode=1;});
server.listen(port,host,()=>console.log(`Monster Skyway is ready: http://127.0.0.1:${port}${host==='0.0.0.0'?' (also available on your local network)':''}`));
