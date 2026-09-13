// Test-only: a minimal PostgREST shim over local Postgres, so supabase-js can talk
// to a real database in dev. Not deployed; not referenced by any production code.
import http from "node:http";
import { Client } from "pg";
const pg = new Client(process.env.TEST_DATABASE_URL
  ? { connectionString: process.env.TEST_DATABASE_URL }
  : { host:"/tmp", port:5433, database:"untiltest", user:"pgtest" });
await pg.connect();
http.createServer((req,res)=>{ let b=""; req.on("data",c=>b+=c); req.on("end",async()=>{
  const send=(c,o)=>{res.writeHead(c,{"Content-Type":"application/json"});res.end(JSON.stringify(o));};
  try{
    const m=req.url.match(/^\/rest\/v1\/(rpc\/)?([^?]+)/); if(!m) return send(404,{});
    const p=b?JSON.parse(b):{};
    if(m[1]){const k=Object.keys(p);
      const r=await pg.query(`select * from ${m[2]}(${k.map((x,i)=>`${x} => $${i+1}`).join(",")})`,k.map(x=>p[x]));
      return send(200,r.rows);}
    const row=Array.isArray(p)?p[0]:p;
    const c=Object.keys(row).filter(x=>row[x]!==undefined);
    const r=await pg.query(`insert into ${m[2]} (${c.join(",")}) values (${c.map((_,i)=>`$${i+1}`).join(",")}) returning *`,c.map(x=>row[x]));
    send(201,r.rows);
  }catch(e){send(400,{message:e.message});}
});}).listen(54321, ()=>console.log("shim listening on 54321"));
