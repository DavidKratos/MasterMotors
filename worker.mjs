const json=(data,status=200,headers={})=>Response.json(data,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...headers}});
const encoder=new TextEncoder();
const hex=b=>Array.from(new Uint8Array(b),v=>v.toString(16).padStart(2,'0')).join('');
const digest=async s=>hex(await crypto.subtle.digest('SHA-256',encoder.encode(s)));
async function passwordHash(password,salt){const key=await crypto.subtle.importKey('raw',encoder.encode(password),'PBKDF2',false,['deriveBits']);return hex(await crypto.subtle.deriveBits({name:'PBKDF2',salt:encoder.encode(salt),iterations:100000,hash:'SHA-256'},key,256));}
function equal(a,b){if(typeof a!=='string'||typeof b!=='string'||a.length!==b.length)return false;let n=0;for(let i=0;i<a.length;i++)n|=a.charCodeAt(i)^b.charCodeAt(i);return n===0;}
const cookie=(value,age)=>`mm_session=${value}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${age}`;
async function session(request,db){const token=request.headers.get('Cookie')?.match(/(?:^|;\s*)mm_session=([a-f0-9]{64})(?:;|$)/)?.[1];if(!token)return null;return db.prepare('SELECT token_hash FROM sessions WHERE token_hash=? AND expires>?').bind(await digest(token),Date.now()).first();}
function validState(x){return x&&Array.isArray(x.jobs)&&Array.isArray(x.services)&&Array.isArray(x.invoices)&&Array.isArray(x.activity)&&x.settings&&typeof x.settings.name==='string'&&Number.isFinite(Number(x.settings.tax))&&Number(x.settings.tax)>=0&&Number(x.settings.tax)<=100&&x.jobs.every(j=>typeof j.id==='string'&&typeof j.status==='string'&&Array.isArray(j.items)&&j.items.every(i=>typeof i.name==='string'&&Number.isFinite(i.rate)&&i.rate>=0&&Number.isFinite(i.qty)&&i.qty>0))&&x.services.every(s=>Array.isArray(s)&&typeof s[0]==='string'&&Number.isFinite(s[2])&&s[2]>=0)&&x.invoices.every(i=>typeof i.id==='string'&&Array.isArray(i.items)&&Number.isFinite(i.amount));}
export default {async fetch(request,env){const url=new URL(request.url);if(!url.pathname.startsWith('/api/'))return env.ASSETS.fetch(request);try{
if(!env.DB)return json({error:'Database binding is not configured.'},503);
if(!['GET','POST','PUT'].includes(request.method))return json({error:'Method not allowed'},405);
if(request.method!=='GET'){if(request.headers.get('Origin')!==url.origin||!request.headers.get('Content-Type')?.startsWith('application/json'))return json({error:'Invalid request origin or content type'},403);if(Number(request.headers.get('Content-Length')||0)>1500000)return json({error:'Request too large'},413);}
if(url.pathname==='/api/login'&&request.method==='POST'){
 const ip=await digest(request.headers.get('CF-Connecting-IP')||'unknown');const now=Date.now();
 const attempt=await env.DB.prepare('INSERT INTO login_limits (ip,attempts,reset_at) VALUES (?,1,?) ON CONFLICT(ip) DO UPDATE SET attempts=CASE WHEN reset_at<? THEN 1 ELSE attempts+1 END,reset_at=CASE WHEN reset_at<? THEN excluded.reset_at ELSE reset_at END RETURNING attempts').bind(ip,now+900000,now,now).first();
 if(attempt.attempts>10)return json({error:'Too many attempts. Try again in 15 minutes.'},429);
 const data=await request.json();if(typeof data.username!=='string'||typeof data.password!=='string'||data.password.length>200)return json({error:'Incorrect username or password'},401);
 const admin=await env.DB.prepare('SELECT salt,password_hash FROM administrators WHERE username=?').bind(data.username).first();
 const hash=await passwordHash(data.password,admin?.salt||'invalid-user-constant-salt');if(!admin||!equal(hash,admin.password_hash))return json({error:'Incorrect username or password'},401);
 const token=hex(crypto.getRandomValues(new Uint8Array(32)));await env.DB.prepare('INSERT INTO sessions(token_hash,expires) VALUES (?,?)').bind(await digest(token),now+43200000).run();
 await env.DB.batch([env.DB.prepare('DELETE FROM sessions WHERE expires<?').bind(now),env.DB.prepare('DELETE FROM login_limits WHERE reset_at<? OR ip=?').bind(now,ip)]);
 return json({ok:true},200,{'Set-Cookie':cookie(token,43200)});
}
if(!await session(request,env.DB))return json({error:'Please sign in'},401);
if(url.pathname==='/api/session'&&request.method==='GET')return json({ok:true,username:'ADMIN'});
if(url.pathname==='/api/logout'&&request.method==='POST'){const token=request.headers.get('Cookie')?.match(/mm_session=([a-f0-9]{64})/)?.[1];if(token)await env.DB.prepare('DELETE FROM sessions WHERE token_hash=?').bind(await digest(token)).run();return json({ok:true},200,{'Set-Cookie':cookie('',0)});}
if(url.pathname==='/api/state'&&request.method==='GET'){const row=await env.DB.prepare('SELECT data,version FROM workshop WHERE id=1').first();return json({state:row?JSON.parse(row.data):null,version:row?.version||0});}
if(url.pathname==='/api/state'&&request.method==='PUT'){
 const raw=await request.text();if(encoder.encode(raw).length>1500000)return json({error:'Workspace exceeds 1.5 MB. Export a backup and contact support.'},413);const {state,version,mutation}=JSON.parse(raw);
 if(!validState(state)||!Number.isSafeInteger(version)||version<0||typeof mutation!=='string'||mutation.length>80)return json({error:'Invalid workshop data'},400);
 const serialized=JSON.stringify(state);const now=new Date().toISOString();
 const prior=await env.DB.prepare('SELECT version,last_mutation FROM workshop WHERE id=1').first();if(prior?.last_mutation===mutation)return json({version:prior.version});
 let result;if(version===0){result=await env.DB.prepare('INSERT OR IGNORE INTO workshop(id,data,version,updated_at,last_mutation) VALUES (1,?,1,?,?)').bind(serialized,now,mutation).run();}else{result=await env.DB.prepare('UPDATE workshop SET data=?,version=version+1,updated_at=?,last_mutation=? WHERE id=1 AND version=?').bind(serialized,now,mutation,version).run();}
 if(!result.meta.changes)return json({error:'Another device updated the records. Export unsaved changes and reload before editing.'},409);
 return json({version:version+1});
}
return json({error:'Not found'},404);
}catch(error){console.error('API failure',error?.message);return json({error:'Unable to complete the request. Please retry.'},500);}}};
