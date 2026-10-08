import { database, rows, run, requireValue, type PortalEnv } from './portal-db';
export function mailReady(env:PortalEnv){return Boolean(env.RESEND_API_KEY&&env.MAIL_FROM);}
export async function sendMail(env:PortalEnv,to:string,subject:string,text:string,key:string){
  requireValue(mailReady(env),'Email verification is not configured yet. Please contact the hostel office.',503);
  const result=await fetch('https://api.resend.com/emails',{method:'POST',headers:{'Authorization':`Bearer ${env.RESEND_API_KEY}`,'Content-Type':'application/json','Idempotency-Key':key},body:JSON.stringify({from:env.MAIL_FROM,to:[to],subject,text}),signal:AbortSignal.timeout(15000)});
  requireValue(result.ok,'Email could not be delivered. Please try again shortly.',503);
}
export async function processWarnings(env:PortalEnv){
  const db=database(env),now=Date.now();
  // Only imported schedules have deadlines. Late imports do not create retroactive penalties.
  const overdue=await rows<{id:string;mess_id:string;name:string;date:string;slot:string;deadline:number}>(db,`SELECT m.id,m.mess_id,x.name,m.date,m.slot,m.deadline FROM meals m JOIN messes x ON x.id=m.mess_id WHERE x.active=1 AND m.deadline<? AND m.imported<m.deadline AND NOT EXISTS(SELECT 1 FROM proofs p WHERE p.meal_id=m.id AND p.received<=m.deadline) AND NOT EXISTS(SELECT 1 FROM warnings w WHERE w.meal_id=m.id) ORDER BY m.deadline LIMIT 100`,now);
  for(const meal of overdue){
    const id=crypto.randomUUID();
    const inserted=await run(db,'INSERT OR IGNORE INTO warnings (id,meal_id,created) VALUES (?,?,?)',id,meal.id,now);
    if(!inserted.meta.changes)continue;
  }
  // Repairable outbox insertion: a crash between warning creation and email queuing is safe.
  const missing=await rows<{id:string;email:string;uid:string;name:string;date:string;slot:string;deadline:number}>(db,`SELECT w.id,u.email,u.id uid,x.name,m.date,m.slot,m.deadline FROM warnings w JOIN meals m ON m.id=w.meal_id JOIN messes x ON x.id=m.mess_id JOIN users u ON u.mess_id=m.mess_id AND u.role='incharge' AND u.active=1 WHERE NOT EXISTS(SELECT 1 FROM outbox o WHERE o.id=w.id||':'||u.id) LIMIT 100`);
  for(const w of missing)await run(db,'INSERT OR IGNORE INTO outbox (id,recipient,subject,body,created) VALUES (?,?,?,?,?)',`${w.id}:${w.uid}`,w.email,`Missed meal readiness: ${w.name}`,`No on-time meal readiness photo was recorded for ${w.name}, ${w.date}, ${w.slot}. Deadline: ${new Date(w.deadline).toISOString()} (UTC). Warning reference: ${w.id}. A later photo does not remove this audit record.`,now);
  if(mailReady(env)){
    const pending=await rows<{id:string;recipient:string;subject:string;body:string;attempts:number}>(db,'SELECT * FROM outbox WHERE sent IS NULL AND next_attempt<=? AND lease<? ORDER BY created LIMIT 20',now,now);
    for(const message of pending){
      const lock=await run(db,'UPDATE outbox SET lease=? WHERE id=? AND sent IS NULL AND lease<?',now+60000,message.id,now);
      if(!lock.meta.changes)continue;
      try{await sendMail(env,message.recipient,message.subject,message.body,`warning-${message.id}`);await run(db,'UPDATE outbox SET sent=?,lease=0,last_error=NULL WHERE id=?',Date.now(),message.id);}
      catch{await run(db,'UPDATE outbox SET attempts=attempts+1,next_attempt=?,lease=0,last_error=? WHERE id=?',now+Math.min(86400000,60000*2**Math.min(message.attempts,10)),'Delivery failed; retry queued',message.id);}
    }
  }
  await db.batch([db.prepare('DELETE FROM rate_limits WHERE expires<?').bind(now),db.prepare('DELETE FROM sessions WHERE expires<?').bind(now),db.prepare('DELETE FROM challenges WHERE expires<?').bind(now-86400000),db.prepare('DELETE FROM capture_tickets WHERE expires<?').bind(now-86400000)]);
  await run(db,"INSERT INTO audit (id,actor,mess_id,event,details,created) VALUES (?,NULL,NULL,'readiness_check_completed','Scheduled check completed',?)",crypto.randomUUID(),now);
  return {checkedAt:new Date(now).toISOString(),warningsCreated:overdue.length};
}
