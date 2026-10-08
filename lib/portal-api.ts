import { z } from 'zod';
import { database, one, rows, run, auditStatement, requireValue as check, PortalError, type PortalEnv } from './portal-db';
import { randomToken, digest, hashSecret, verifySecret, sameSecret } from './portal-security';
import { indiaDate, monthWindow, validDate, studentEmail, canAccessMess, SLOTS, type Role } from './portal-domain';
import { mailReady, sendMail, processWarnings } from './portal-mail';
import { fetchMessit } from './messit-import';
import { calendarFor } from './festival-calendar';

type User={id:string;email:string;name:string;registration:string|null;role:Role;mess_id:string|null;verified:number;active:number;secret:string};
const SESSION='__Host-messmate_session',CHALLENGE='__Host-messmate_challenge';
const text=z.string().trim().min(1).max(160),uuid=z.string().uuid();
const item=z.object({name:text,portion:z.string().max(80).optional(),nutrition:z.object({calories:z.number().min(0).max(10000),protein:z.number().min(0).max(1000),carbs:z.number().min(0).max(1000),fat:z.number().min(0).max(1000),source:z.string().url().startsWith('https://')}).optional()});
function cookie(req:Request,name:string){return req.headers.get('cookie')?.split(';').map(s=>s.trim()).find(s=>s.startsWith(name+'='))?.slice(name.length+1)||'';}
function setCookie(name:string,value:string,seconds:number){return `${name}=${value}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${seconds}`;}
function json(value:unknown,status=200,cookies:string[]=[]){const h=new Headers({'Content-Type':'application/json','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'});for(const c of cookies)h.append('Set-Cookie',c);return new Response(JSON.stringify(value),{status,headers:h});}
async function limit(db:D1Database,key:string,max:number,ms=900000){const now=Date.now(),bucket=Math.floor(now/ms),id=digest(`${key}:${bucket}`);const r=await one<{count:number}>(db,'INSERT INTO rate_limits (key,count,expires) VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1 RETURNING count',id,(bucket+1)*ms);check(r&&r.count<=max,'Too many attempts. Please try again later.',429);}
export async function authenticated(db:D1Database,req:Request){const token=cookie(req,SESSION);check(token,'Please sign in to continue.',401);const u=await one<User>(db,'SELECT u.* FROM users u JOIN sessions s ON s.user_id=u.id WHERE s.hash=? AND s.expires>? AND u.active=1 AND u.verified=1',digest(token),Date.now());check(u,'Your session has expired. Please sign in again.',401);return u;}
function role(user:User,...allowed:Role[]){check(allowed.includes(user.role),'This action is not available for your account.',403);}
async function messAccess(db:D1Database,user:User,id:string){check(canAccessMess(user,id),'This mess is not assigned to your account.',403);const m=await one<{id:string;name:string;slug:string;grace:number}>(db,'SELECT * FROM messes WHERE id=? AND active=1',id);check(m,'Mess not found.',404);return m;}
async function mealAccess(db:D1Database,user:User,id:string){const m=await one<{id:string;mess_id:string;start:number;end:number;deadline:number}>(db,'SELECT * FROM meals WHERE id=?',id);check(m,'Meal not found.',404);await messAccess(db,user,m.mess_id);return m;}
function pattern(value:string,pattern:string|undefined){if(!pattern)return false;try{return new RegExp(`^(?:${pattern})$`,'i').test(value);}catch{throw new PortalError(503,'The account format has not been configured correctly.');}}
async function session(db:D1Database,u:User){const token=randomToken();await run(db,'INSERT INTO sessions (hash,user_id,expires) VALUES (?,?,?)',digest(token),u.id,Date.now()+8*3600000);return json({signedIn:true},200,[setCookie(SESSION,token,8*3600),setCookie(CHALLENGE,'',0)]);}
async function challenge(db:D1Database,env:PortalEnv,u:User){check(mailReady(env),'Email verification is awaiting setup by the hostel office.',503);const id=randomToken(),code=randomToken().slice(0,12).toUpperCase();await run(db,'INSERT INTO challenges (id,user_id,hash,expires) VALUES (?,?,?,?)',id,u.id,digest(id+code),Date.now()+600000);try{await sendMail(env,u.email,'Your MessMate verification code',`Your verification code is ${code}. It expires in 10 minutes. Do not share this code. If you did not request this sign-in, ignore this message.`,`verify-${id}`);}catch(e){await run(db,'DELETE FROM challenges WHERE id=?',id);throw e;}return json({verificationRequired:true},200,[setCookie(CHALLENGE,id,600)]);}
async function finalists(db:D1Database,mess:string,previous:string){return rows<{dish:string;key:string;submissions:number}>(db,'SELECT MIN(dish) dish,normalized key,COUNT(*) submissions FROM suggestions WHERE mess_id=? AND month=? GROUP BY normalized ORDER BY submissions DESC,normalized ASC LIMIT 5',mess,previous);}

export async function handlePortal(req:Request,env:PortalEnv,action:string):Promise<Response>{
 try{
  const db=database(env),now=Date.now(),url=new URL(req.url);
  if(action==='cron'){
    check(req.method==='POST','Method not allowed.',405);check(env.CRON_SECRET&&sameSecret(req.headers.get('authorization')||'',`Bearer ${env.CRON_SECRET}`),'Unauthorized.',401);
    return json(await processWarnings(env));
  }
  if(req.method!=='GET'){
    const origin=req.headers.get('origin');check(origin==='https://mess-menu-campus.shubkamb.chatgpt.site'||(url.hostname==='terminal.local'&&origin==='http://terminal.local:4173'),'Invalid request origin.',403);
    check(req.method==='POST','Method not allowed.',405);
  }
  if(action==='setup'&&req.method==='GET')return json({emailReady:mailReady(env),registrationReady:Boolean(env.STUDENT_REGISTRATION_PATTERN),wardenReady:Boolean(env.WARDEN_EMAIL_PATTERN&&env.BOOTSTRAP_WARDEN_EMAIL&&env.BOOTSTRAP_WARDEN_HASH),messes:await rows(db,'SELECT id,name,hostel,caterer,category FROM messes WHERE active=1 ORDER BY hostel,name'),window:monthWindow(),today:indiaDate()});
  if(action==='photo'&&req.method==='GET'){
    const u=await authenticated(db,req),p=await one<{meal_id:string;object_key:string}>(db,'SELECT meal_id,object_key FROM proofs WHERE id=?',url.searchParams.get('id'));check(p,'Photo not found.',404);await mealAccess(db,u,p.meal_id);check(env.BUCKET,'Photo storage is unavailable.',503);const object=await env.BUCKET.get(p.object_key);check(object,'Photo not found.',404);return new Response(object.body,{headers:{'Content-Type':'image/jpeg','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
  }
  if(action==='me'&&req.method==='GET'){try{const u=await authenticated(db,req);return json({user:{id:u.id,name:u.name,email:u.email,registration:u.registration,role:u.role,mess_id:u.mess_id},requests:await rows(db,'SELECT r.id,r.status,r.created,m.name FROM membership_requests r JOIN messes m ON m.id=r.mess_id WHERE r.user_id=? ORDER BY r.created DESC',u.id)});}catch(e){if(e instanceof PortalError&&e.status===401)return json({user:null});throw e;}}
  if(action==='data'&&req.method==='GET'){
    const u=await authenticated(db,req),id=url.searchParams.get('mess')||u.mess_id;check(id,'Your mess assignment is awaiting approval.',403);const m=await messAccess(db,u,id),date=url.searchParams.get('date')||indiaDate();check(validDate(date),'Choose a valid date.');
    const window=monthWindow(),mealRows=await rows<{items:string}>(db,'SELECT m.*,p.id proof_id,p.received proof_received FROM meals m LEFT JOIN proofs p ON p.meal_id=m.id WHERE m.mess_id=? AND m.date=? ORDER BY m.start',id,date);
    const base:Record<string,unknown>={mess:m,date,window,meals:mealRows.map(x=>({...x,items:JSON.parse(x.items)})),festivals:date===indiaDate()?await rows(db,'SELECT * FROM festivals WHERE date=? AND (mess_id=? OR mess_id IS NULL)',date,id):[]};
    if(date===indiaDate()&&!(base.festivals as unknown[]).length)base.festivals=calendarFor(date);
    if(u.role==='student'&&window.open){const list=await finalists(db,id,window.previous),counts=await rows<{dish:string;count:number}>(db,'SELECT dish,COUNT(*) count FROM votes WHERE mess_id=? AND month=? GROUP BY dish',id,window.month);base.voice={finalists:list.map(f=>({...f,votes:counts.find(x=>x.dish===f.key)?.count||0})),vote:await one(db,'SELECT dish FROM votes WHERE user_id=? AND month=?',u.id,window.month),survey:await one(db,'SELECT id FROM surveys WHERE user_id=? AND month=?',u.id,window.month),suggestion:await one(db,'SELECT dish FROM suggestions WHERE user_id=? AND month=?',u.id,window.month)};}
    if(u.role!=='student'){
      base.lastCheck=await one(db,"SELECT created FROM audit WHERE event='readiness_check_completed' ORDER BY created DESC LIMIT 1");
      base.emailReady=mailReady(env);
      base.requests=await rows(db,"SELECT r.id,r.created,u.name,u.registration FROM membership_requests r JOIN users u ON u.id=r.user_id WHERE r.mess_id=? AND r.status='pending' AND u.verified=1 ORDER BY r.created",id);
      base.warnings=await rows(db,'SELECT w.*,m.date,m.slot,p.received proof_received,(SELECT COUNT(*) FROM outbox o WHERE o.id LIKE w.id||\':%\' AND o.sent IS NOT NULL) emails_sent FROM warnings w JOIN meals m ON m.id=w.meal_id LEFT JOIN proofs p ON p.meal_id=m.id WHERE m.mess_id=? ORDER BY w.created DESC LIMIT 100',id);
      base.ratings=await rows(db,'SELECT month,COUNT(*) count,AVG(taste) taste,AVG(quantity) quantity,AVG(hygiene) hygiene,AVG(timing) timing FROM surveys WHERE mess_id=? GROUP BY month ORDER BY month DESC LIMIT 12',id);
      base.audit=await rows(db,'SELECT event,details,created FROM audit WHERE mess_id=? ORDER BY created DESC LIMIT 50',id);
    }
    return json(base);
  }
  check(req.method==='POST','Not found.',404);
  if(action==='capture-upload')return await upload(req,env,db);
  const raw=await req.text();check(raw.length<=250000,'Request is too large.',413);let body:unknown;try{body=JSON.parse(raw);}catch{throw new PortalError(400,'Invalid request.');}
  if(['login','register','verify'].includes(action))await limit(db,`auth-ip:${req.headers.get('cf-connecting-ip')||'unknown'}`,40);
  if(action==='register'){
    const b=z.object({name:text,email:z.string().trim().toLowerCase().email(),registration:text,password:z.string().min(12).max(128),messId:uuid}).parse(body);
    check(mailReady(env)&&env.STUDENT_REGISTRATION_PATTERN,'Student registration is awaiting setup by the hostel office.',503);check(studentEmail(b.email),'Use your firstname.lastname20XX@vitstudent.ac.in email.');check(pattern(b.registration,env.STUDENT_REGISTRATION_PATTERN),'The registration number does not match the VIT format.');
    check(await one(db,'SELECT id FROM messes WHERE id=? AND active=1',b.messId),'Choose an active mess.');await limit(db,'register:'+b.email,3,3600000);check(!await one(db,'SELECT id FROM users WHERE email=? OR registration=?',b.email,b.registration.toUpperCase()),'An account already exists. Please sign in.',409);
    const id=crypto.randomUUID(),secret=await hashSecret(b.password);
    await db.batch([db.prepare("INSERT INTO users (id,email,name,registration,role,secret,created) VALUES (?,?,?,?,'student',?,?)").bind(id,b.email,b.name,b.registration.toUpperCase(),secret,now),db.prepare('INSERT INTO membership_requests (id,user_id,mess_id,created) VALUES (?,?,?,?)').bind(crypto.randomUUID(),id,b.messId,now)]);
    return challenge(db,env,(await one<User>(db,'SELECT * FROM users WHERE id=?',id))!);
  }
  if(action==='login'){
    const b=z.object({role:z.enum(['student','incharge','warden']),identifier:text,secret:z.string().min(1).max(128)}).parse(body),identifier=b.identifier.toLowerCase();await limit(db,'login:'+identifier,8);
    if(b.role==='student')check(studentEmail(identifier),'Use your VIT student email.');
    if(b.role==='warden'){
      check(env.WARDEN_EMAIL_PATTERN,'Warden email format is awaiting configuration.',503);check(pattern(identifier,env.WARDEN_EMAIL_PATTERN),'Use your authorized warden email.');
      if(identifier===env.BOOTSTRAP_WARDEN_EMAIL?.toLowerCase()&&env.BOOTSTRAP_WARDEN_HASH)await run(db,"INSERT OR IGNORE INTO users (id,email,name,role,secret,created) VALUES (?,?,?,'warden',?,?)",crypto.randomUUID(),identifier,'Hostel food warden',env.BOOTSTRAP_WARDEN_HASH,now);
    }
    const u=await one<User>(db,`SELECT * FROM users WHERE ${b.role==='incharge'?'login':'email'}=? AND role=? AND active=1`,identifier,b.role);
    // Perform the same expensive password work for unknown accounts.
    const dummy='pbkdf2-sha256$600000$00000000000000000000000000000000$'+'0'.repeat(64);
    const valid=await verifySecret(b.secret,u?.secret||dummy);check(u&&valid,'The sign-in details are incorrect.',401);
    return b.role==='incharge'?session(db,u):challenge(db,env,u);
  }
  if(action==='verify'){
    const b=z.object({code:z.string().trim().length(12)}).parse(body),id=cookie(req,CHALLENGE);check(id,'Verification expired. Please sign in again.',401);
    const c=await one<{user_id:string;hash:string;attempts:number}>(db,'UPDATE challenges SET attempts=attempts+1 WHERE id=? AND used=0 AND expires>? AND attempts<5 RETURNING user_id,hash,attempts',id,now);check(c&&sameSecret(c.hash,digest(id+b.code.toUpperCase())),'Invalid or expired code. Sign in again after five attempts.',401);
    const consumed=await run(db,'UPDATE challenges SET used=1 WHERE id=? AND used=0 AND expires>?',id,now);check(consumed.meta.changes,'This code has already been used.',401);
    await run(db,'UPDATE users SET verified=1 WHERE id=?',c.user_id);const u=await one<User>(db,'SELECT * FROM users WHERE id=? AND active=1',c.user_id);check(u,'Account unavailable.',401);return session(db,u);
  }
  const u=await authenticated(db,req);await limit(db,'write:'+u.id,100,60000);
  if(action==='logout'){await run(db,'DELETE FROM sessions WHERE hash=?',digest(cookie(req,SESSION)));return json({ok:true},200,[setCookie(SESSION,'',0),setCookie(CHALLENGE,'',0)]);}
  if(action==='request-mess'){
    role(u,'student');const b=z.object({messId:uuid}).parse(body);check(await one(db,'SELECT id FROM messes WHERE id=? AND active=1',b.messId),'Mess not found.',404);check(b.messId!==u.mess_id,'You already belong to this mess.');await limit(db,'request:'+u.id,3,86400000);
    await db.batch([db.prepare("UPDATE membership_requests SET status='cancelled',decided=? WHERE user_id=? AND status='pending'").bind(now,u.id),db.prepare('INSERT INTO membership_requests (id,user_id,mess_id,created) VALUES (?,?,?,?)').bind(crypto.randomUUID(),u.id,b.messId,now),auditStatement(db,u.id,u.mess_id,'assignment_requested',b.messId)]);return json({ok:true});
  }
  if(action==='approve'){
    role(u,'incharge');const b=z.object({requestId:uuid,approve:z.boolean()}).parse(body);const r=await one<{user_id:string;mess_id:string}>(db,"SELECT r.user_id,r.mess_id FROM membership_requests r JOIN users u ON u.id=r.user_id WHERE r.id=? AND r.status='pending' AND u.verified=1",b.requestId);check(r,'Request is no longer pending.',409);await messAccess(db,u,r.mess_id);
    const statements=[];if(b.approve)statements.push(db.prepare("UPDATE users SET mess_id=? WHERE id=? AND EXISTS(SELECT 1 FROM membership_requests WHERE id=? AND status='pending')").bind(r.mess_id,r.user_id,b.requestId));
    statements.push(db.prepare("UPDATE membership_requests SET status=?,reviewer=?,decided=? WHERE id=? AND status='pending'").bind(b.approve?'approved':'rejected',u.id,now,b.requestId));
    if(b.approve)statements.push(db.prepare("UPDATE membership_requests SET status='cancelled',decided=? WHERE user_id=? AND id<>? AND status='pending'").bind(now,r.user_id,b.requestId));
    statements.push(auditStatement(db,u.id,r.mess_id,b.approve?'membership_approved':'membership_rejected',b.requestId));await db.batch(statements);return json({ok:true});
  }
  if(['survey','suggest','vote'].includes(action)){
    role(u,'student');check(u.mess_id,'Mess approval is required.',403);await messAccess(db,u,u.mess_id);const w=monthWindow();check(w.open,'Monthly feedback is currently closed.',403);
    if(action==='survey'){const b=z.object({taste:z.number().int().min(1).max(5),quantity:z.number().int().min(1).max(5),hygiene:z.number().int().min(1).max(5),timing:z.number().int().min(1).max(5),comment:z.string().trim().max(1000)}).parse(body);await run(db,'INSERT INTO surveys (id,user_id,mess_id,month,taste,quantity,hygiene,timing,comment,created) VALUES (?,?,?,?,?,?,?,?,?,?)',crypto.randomUUID(),u.id,u.mess_id,w.month,b.taste,b.quantity,b.hygiene,b.timing,b.comment,now);}
    if(action==='suggest'){const b=z.object({dish:z.string().trim().min(2).max(80),credit:z.boolean()}).parse(body);await run(db,'INSERT INTO suggestions (id,user_id,mess_id,month,dish,normalized,credit,created) VALUES (?,?,?,?,?,?,?,?)',crypto.randomUUID(),u.id,u.mess_id,w.month,b.dish,b.dish.toLowerCase().replace(/\s+/g,' '),b.credit?1:0,now);}
    if(action==='vote'){const b=z.object({dish:text}).parse(body);check((await finalists(db,u.mess_id,w.previous)).some(f=>f.key===b.dish),'This dish is not on the shortlist.');await run(db,'INSERT INTO votes (id,user_id,mess_id,month,dish,created) VALUES (?,?,?,?,?,?) ON CONFLICT(user_id,month) DO UPDATE SET dish=excluded.dish WHERE votes.mess_id=excluded.mess_id',crypto.randomUUID(),u.id,u.mess_id,w.month,b.dish,now);}
    return json({ok:true});
  }
  if(action==='capture-ticket'){role(u,'incharge');const b=z.object({mealId:uuid}).parse(body),m=await mealAccess(db,u,b.mealId);check(now>=m.start-1800000&&now<=m.end,'Capture opens 30 minutes before serving and closes at the end of the meal.');const ticket=crypto.randomUUID();await run(db,'INSERT INTO capture_tickets (id,user_id,meal_id,expires) VALUES (?,?,?,?)',ticket,u.id,m.id,now+120000);return json({ticket,expires:now+120000});}
  if(action==='warning-response'){role(u,'incharge','warden');const b=z.object({id:uuid,response:z.string().trim().min(5).max(1000),resolve:z.boolean()}).parse(body);const warning=await one<{meal_id:string}>(db,'SELECT meal_id FROM warnings WHERE id=?',b.id);check(warning,'Warning not found.',404);const m=await mealAccess(db,u,warning.meal_id);check(!b.resolve||u.role==='warden','Only the food warden can resolve a warning.',403);await db.batch([db.prepare('UPDATE warnings SET response=?,reviewer=?,resolved=CASE WHEN ?=1 THEN ? ELSE resolved END WHERE id=? AND (resolved IS NULL OR ?=1)').bind(b.response,u.id,b.resolve?1:0,now,b.id,u.role==='warden'?1:0),auditStatement(db,u.id,m.mess_id,b.resolve?'warning_resolved':'warning_response',JSON.stringify({id:b.id,response:b.response}))]);return json({ok:true});}
  if(action==='create-mess'){role(u,'warden');const b=z.object({name:text,slug:z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(100),hostel:text,caterer:text,category:z.enum(['Special','Veg','Non-Veg']),grace:z.number().int().min(0).max(120)}).parse(body),id=crypto.randomUUID();await db.batch([db.prepare('INSERT INTO messes (id,slug,name,hostel,caterer,category,grace) VALUES (?,?,?,?,?,?,?)').bind(id,b.slug,b.name,b.hostel,b.caterer,b.category,b.grace),auditStatement(db,u.id,id,'mess_created',b.name)]);return json({ok:true});}
  if(action==='create-incharge'){role(u,'warden');const b=z.object({name:text,email:z.string().trim().toLowerCase().email(),login:z.string().trim().toLowerCase().regex(/^[a-z0-9-]{4,40}$/),messId:uuid,key:z.string().min(16).max(128)}).parse(body);await messAccess(db,u,b.messId);await db.batch([db.prepare("INSERT INTO users (id,email,login,name,role,secret,mess_id,verified,created) VALUES (?,?,?,?,'incharge',?,?,1,?)").bind(crypto.randomUUID(),b.email,b.login,b.name,await hashSecret(b.key),b.messId,now),auditStatement(db,u.id,b.messId,'incharge_created',b.login)]);return json({ok:true});}
  if(action==='import-messit'){
    role(u,'incharge','warden');const b=z.object({messId:uuid,hostel:z.number().int().min(1).max(2),category:z.number().int().min(1).max(3),month:z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/)}).parse(body);await messAccess(db,u,b.messId);await limit(db,'import:'+u.id,5,3600000);
    let feed;try{feed=await fetchMessit(b.hostel,b.category,b.month);}catch{throw new PortalError(503,'MessIT could not be loaded. Use the structured menu import or retry later.');}
    check(feed.meals.length,'MessIT has no menu for this month.',404);return importMenu(db,u,{messId:b.messId,...feed});
  }
  if(action==='import-menu')return await importMenu(db,u,body);
  if(action==='festival'){role(u,'warden');const b=z.object({messId:uuid,date:z.string().refine(validDate),name:text,source:z.string().url().startsWith('https://'),items:z.array(item).min(1).max(30)}).parse(body);await messAccess(db,u,b.messId);await db.batch([db.prepare('INSERT INTO festivals (id,date,name,source,mess_id,items) VALUES (?,?,?,?,?,?)').bind(crypto.randomUUID(),b.date,b.name,b.source,b.messId,JSON.stringify(b.items)),auditStatement(db,u.id,b.messId,'festival_added',`${b.date}: ${b.name}`)]);return json({ok:true});}
  throw new PortalError(404,'Not found.');
 }catch(e){if(e instanceof z.ZodError)return json({error:e.issues[0]?.message||'Please check the form.'},400);if(e instanceof PortalError)return json({error:e.message},e.status);if(String(e).includes('UNIQUE constraint'))return json({error:'This record already exists or has already been submitted.'},409);console.error('Portal request failed',action,e instanceof Error?e.name:'unknown');return json({error:'The portal could not complete this request. Please try again.'},503);}
}

async function upload(req:Request,env:PortalEnv,db:D1Database){
 const u=await authenticated(db,req);role(u,'incharge');await limit(db,'photo:'+u.id,10,60000);check(env.BUCKET,'Photo storage is unavailable.',503);check(Number(req.headers.get('content-length')||0)<=6*1024*1024,'Photo is too large.',413);
 const form=await req.formData(),ticket=String(form.get('ticket')||''),file=form.get('photo'),captured=Number(form.get('captured'));
 check(file instanceof File&&file.type==='image/jpeg'&&file.size<=5*1024*1024&&file.size>=100,'Capture a JPEG photo under 5 MB.');check(Number.isFinite(captured)&&Math.abs(Date.now()-captured)<120000,'Capture a new photo.');
 const t=await one<{meal_id:string;expires:number}>(db,'SELECT meal_id,expires FROM capture_tickets WHERE id=? AND user_id=? AND used=0 AND expires>?',ticket,u.id,Date.now());check(t,'The camera session expired. Take a new photo.',409);const meal=await mealAccess(db,u,t.meal_id);check(Date.now()<=meal.end,'The serving window has ended.');
 const bytes=new Uint8Array(await file.arrayBuffer());check(bytes[0]===255&&bytes[1]===216&&bytes[2]===255,'Invalid camera image.');const hash=digest(bytes);check(!await one(db,'SELECT id FROM proofs WHERE digest=?',hash),'This image has already been submitted.',409);
 const consumed=await run(db,'UPDATE capture_tickets SET used=1 WHERE id=? AND used=0 AND expires>?',ticket,Date.now());check(consumed.meta.changes,'This camera session has already been used.',409);
 const id=crypto.randomUUID(),key=`proofs/${meal.mess_id}/${meal.id}/${id}.jpg`,received=Date.now();await env.BUCKET.put(key,bytes,{httpMetadata:{contentType:'image/jpeg'}});
 try{await db.batch([db.prepare('INSERT INTO proofs (id,meal_id,user_id,object_key,digest,received,client_captured) VALUES (?,?,?,?,?,?,?)').bind(id,meal.id,u.id,key,hash,received,captured),auditStatement(db,u.id,meal.mess_id,'readiness_photo_received',JSON.stringify({mealId:meal.id,proofId:id,received,late:received>meal.deadline}))]);}
 catch(e){await env.BUCKET.delete(key);throw e;}return json({ok:true,received,late:received>meal.deadline});
}

async function importMenu(db:D1Database,u:User,body:unknown){
 role(u,'incharge','warden');const b=z.object({messId:uuid,source:z.string().url().startsWith('https://'),meals:z.array(z.object({date:z.string().refine(validDate),slot:z.enum(SLOTS),start:z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),end:z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),items:z.array(item).min(1).max(40)})).min(1).max(124)}).parse(body);
 const mess=await messAccess(db,u,b.messId),now=Date.now(),seen=new Set<string>(),statements=[];
 for(const m of b.meals){const key=m.date+m.slot;check(!seen.has(key),'The import contains duplicate meal slots.');seen.add(key);const start=Date.parse(`${m.date}T${m.start}:00+05:30`),end=Date.parse(`${m.date}T${m.end}:00+05:30`);check(end>start,'Serving end time must follow start time.');
 statements.push(db.prepare('INSERT INTO meals (id,mess_id,date,slot,items,source,start,end,deadline,imported) VALUES (?,?,?,?,?,?,?,?,?,?) ON CONFLICT(mess_id,date,slot) DO UPDATE SET items=excluded.items,source=excluded.source,start=excluded.start,end=excluded.end,deadline=excluded.deadline,imported=excluded.imported WHERE meals.start>?').bind(crypto.randomUUID(),b.messId,m.date,m.slot,JSON.stringify(m.items),b.source,start,end,start+mess.grace*60000,now,now));}
 statements.push(auditStatement(db,u.id,b.messId,'menu_imported',`${b.meals.length} meals; ${b.source}`));await db.batch(statements);return json({ok:true,imported:b.meals.length});
}
