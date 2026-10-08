// Runs the actual route logic against an isolated SQLite database. No production writes or email.
import { DatabaseSync } from 'node:sqlite';
import { readFile,writeFile,mkdir,readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';
import ts from 'typescript';
const root=resolve('.sites-runtime/portal-tests');await mkdir(root,{recursive:true});
for(const file of ['portal-domain','portal-security','portal-db','portal-mail','festival-calendar','nutrition-reference','messit-import','portal-api']){const source=await readFile(`lib/${file}.ts`,'utf8');const out=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText.replace(/from '(\.\/[^']+)'/g,"from '$1.mjs'");await writeFile(`${root}/${file}.mjs`,out);}
const {handlePortal}=await import(pathToFileURL(`${root}/portal-api.mjs`));
const {digest,hashSecret,verifySecret}=await import(pathToFileURL(`${root}/portal-security.mjs`));
const {monthWindow,indiaDate,studentEmail}=await import(pathToFileURL(`${root}/portal-domain.mjs`));
const {processWarnings}=await import(pathToFileURL(`${root}/portal-mail.mjs`));
const {calendarFor}=await import(pathToFileURL(`${root}/festival-calendar.mjs`));
assert.equal(calendarFor('2026-09-14')[0].name,'Vinayakar Chathurthi');assert.equal(calendarFor('2026-09-15').length,0);assert.equal(calendarFor('2027-01-15').length,0);
const sql=new DatabaseSync(':memory:');sql.exec('PRAGMA foreign_keys=ON');
for(const f of (await readdir('drizzle')).filter(f=>f.endsWith('.sql')).sort())sql.exec(await readFile('drizzle/'+f,'utf8'));
class Statement{constructor(query,args=[]){this.query=query;this.args=args;}bind(...args){return new Statement(this.query,args);}async first(){return sql.prepare(this.query).get(...this.args)||null;}async all(){return {results:sql.prepare(this.query).all(...this.args)};}async run(){const r=sql.prepare(this.query).run(...this.args);return {meta:{changes:Number(r.changes)}};}}
const DB={prepare:q=>new Statement(q),batch:async statements=>{sql.exec('BEGIN');try{const results=[];for(const s of statements)results.push(await s.run());sql.exec('COMMIT');return results;}catch(e){sql.exec('ROLLBACK');throw e;}}};
const env={DB,CRON_SECRET:'isolated-test-cron-secret',RESEND_API_KEY:'isolated-test-key',MAIL_FROM:'test@example.com',STUDENT_REGISTRATION_PATTERN:'[0-9]{2}[A-Z]{3}[0-9]{4}'};
const now=Date.now(),uuid=()=>crypto.randomUUID(),a=uuid(),b=uuid(),student=uuid(),pending=uuid(),incharge=uuid(),warden=uuid();
for(const [id,slug] of [[a,'a'],[b,'b']])sql.prepare('INSERT INTO messes (id,slug,name,caterer,hostel,category) VALUES (?,?,?,?,?,?)').run(id,slug,'Test '+slug,'Test caterer','Test hostel','Special');
const password='A long isolated test password!',hash=await hashSecret(password);assert(await verifySecret(password,hash));assert(!await verifySecret('wrong password',hash));
for(const [id,role,mess] of [[student,'student',a],[pending,'student',null],[incharge,'incharge',a],[warden,'warden',null]]){sql.prepare('INSERT INTO users (id,email,login,name,role,secret,mess_id,verified,created) VALUES (?,?,?,?,?,?,?,?,?)').run(id,`${id}@vitstudent.ac.in`,role==='incharge'?'test-incharge':null,'Test User',role,hash,mess,1,now);sql.prepare('INSERT INTO sessions (hash,user_id,expires) VALUES (?,?,?)').run(digest(id),id,now+1000000);}
const call=(who,action,body,origin='https://mess-menu-campus.shubkamb.chatgpt.site')=>handlePortal(new Request(`https://mess-menu-campus.shubkamb.chatgpt.site/api/portal/${action}`,{method:body===undefined?'GET':'POST',headers:{cookie:who?`__Host-messmate_session=${who}`:'',origin,'Content-Type':'application/json','cf-connecting-ip':'192.0.2.1'},body:body===undefined?undefined:JSON.stringify(body)}),env,action.split('?')[0]);
assert.equal((await call(null,'data?mess='+a)).status,401);
assert.equal((await call(student,'data?mess='+a)).status,200);
assert.equal((await call(student,'data?mess='+b)).status,403);
assert.equal((await call(incharge,'data?mess='+b)).status,403);
assert.equal((await call(warden,'data?mess='+b)).status,200);
assert.equal((await call(pending,'data?mess='+a)).status,403);
assert.equal((await call(student,'create-mess',{})).status,403);
assert.equal((await call(incharge,'logout',{},'https://attacker.example')).status,403);
const rid=uuid();sql.prepare('INSERT INTO membership_requests (id,user_id,mess_id,created) VALUES (?,?,?,?)').run(rid,pending,b,now);
assert.equal((await call(incharge,'approve',{requestId:rid,approve:true})).status,403);
sql.prepare('UPDATE membership_requests SET mess_id=? WHERE id=?').run(a,rid);
assert.equal((await call(incharge,'approve',{requestId:rid,approve:true})).status,200);
assert.equal((await call(pending,'data?mess='+a)).status,200);
assert.equal((await call(incharge,'approve',{requestId:rid,approve:true})).status,409);
assert.equal(monthWindow(Date.parse('2026-09-23T18:29:59Z')).open,false);
assert.equal(monthWindow(Date.parse('2026-09-23T18:30:00Z')).open,true);
assert.equal(monthWindow(Date.parse('2026-09-30T18:30:00Z')).open,false);
assert.equal(monthWindow(Date.parse('2028-02-23T12:00:00Z')).open,true);
assert.equal(indiaDate(Date.parse('2026-09-14T20:00:00Z')),'2026-09-15');
assert(studentEmail('first.last2026@vitstudent.ac.in'));assert(!studentEmail('first.last2026@vitstudent.ac.in.attacker.com'));
if(!monthWindow().open){assert.equal((await call(student,'survey',{taste:5,quantity:5,hygiene:5,timing:5,comment:''})).status,403);assert(!(await (await call(student,'data?mess='+a)).json()).voice);}
const meal=uuid();sql.prepare('INSERT INTO meals (id,mess_id,date,slot,items,source,start,end,deadline,imported) VALUES (?,?,?,?,?,?,?,?,?,?)').run(meal,a,indiaDate(),'lunch','[]','https://messit.vinnovateit.com',now-3600000,now+3600000,now-60000,now-7200000);
const originalFetch=globalThis.fetch;const sent=[];globalThis.fetch=async(url,options)=>{sent.push(JSON.parse(options.body));return new Response('{}',{status:200});};
try{await processWarnings(env);await processWarnings(env);assert.equal(sql.prepare('SELECT COUNT(*) n FROM warnings').get().n,1);assert.equal(sent.length,1);assert.equal(sql.prepare('SELECT COUNT(*) n FROM outbox WHERE sent IS NOT NULL').get().n,1);
 const login=await call(null,'login',{role:'incharge',identifier:'test-incharge',secret:password});assert.equal(login.status,200);assert.match(login.headers.get('set-cookie'),/HttpOnly; Secure/);
 const email='first.last2026@vitstudent.ac.in';sql.prepare('UPDATE users SET email=? WHERE id=?').run(email,student);
 const start=await call(null,'login',{role:'student',identifier:email,secret:password});assert.equal(start.status,200);assert(!start.headers.get('set-cookie').includes('__Host-messmate_session='));
 const challengeCookie=start.headers.get('set-cookie').split(';')[0],code=sent.at(-1).text.match(/code is ([A-F0-9]{12})/)[1];
 const verify=()=>handlePortal(new Request('https://mess-menu-campus.shubkamb.chatgpt.site/api/portal/verify',{method:'POST',headers:{origin:'https://mess-menu-campus.shubkamb.chatgpt.site',cookie:challengeCookie,'Content-Type':'application/json','cf-connecting-ip':'192.0.2.2'},body:JSON.stringify({code})}),env,'verify');
 assert.equal((await verify()).status,200);assert.equal((await verify()).status,401);
 const warning=sql.prepare('SELECT id FROM warnings').get().id;
 assert.equal((await call(incharge,'warning-response',{id:warning,response:'Prepared later',resolve:true})).status,403);
 assert.equal((await call(warden,'warning-response',{id:warning,response:'Investigated and resolved',resolve:true})).status,200);
 const imported=await call(incharge,'import-menu',{messId:b,source:'https://messit.vinnovateit.com',meals:[{date:'2026-12-01',slot:'breakfast',start:'07:00',end:'09:00',items:[{name:'test'}]}]});assert.equal(imported.status,403);
 assert.equal((await call(incharge,'capture-ticket',{mealId:meal})).status,200);
 const crossMeal=uuid();sql.prepare('INSERT INTO meals (id,mess_id,date,slot,items,source,start,end,deadline,imported) VALUES (?,?,?,?,?,?,?,?,?,?)').run(crossMeal,b,indiaDate(),'lunch','[]','https://messit.vinnovateit.com',now-1000,now+3600000,now+60000,now-7200000);
 assert.equal((await call(incharge,'capture-ticket',{mealId:crossMeal})).status,403);
}finally{globalThis.fetch=originalFetch;sql.close();}
console.log('PASS: tenant isolation, pending approval, role restrictions, CSRF rejection, password hashing, two-step email login, one-use codes, India month boundaries, warning deduplication, email queue, photo authorization, and import isolation.');
