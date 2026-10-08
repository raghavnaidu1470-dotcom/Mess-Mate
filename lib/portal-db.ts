export type PortalEnv={DB?:D1Database;BUCKET?:R2Bucket;RESEND_API_KEY?:string;MAIL_FROM?:string;WARDEN_EMAIL_PATTERN?:string;STUDENT_REGISTRATION_PATTERN?:string;BOOTSTRAP_WARDEN_EMAIL?:string;BOOTSTRAP_WARDEN_HASH?:string;CRON_SECRET?:string};
export class PortalError extends Error {constructor(public status:number,message:string){super(message);}}
export function requireValue(condition:unknown,message:string,status=400):asserts condition {if(!condition)throw new PortalError(status,message);}
export function database(env:PortalEnv){requireValue(env.DB,'The portal database is temporarily unavailable.',503);return env.DB;}
export async function one<T=Record<string,unknown>>(db:D1Database,sql:string,...args:unknown[]){return db.prepare(sql).bind(...args).first<T>();}
export async function rows<T=Record<string,unknown>>(db:D1Database,sql:string,...args:unknown[]){return (await db.prepare(sql).bind(...args).all<T>()).results;}
export async function run(db:D1Database,sql:string,...args:unknown[]){return db.prepare(sql).bind(...args).run();}
export function auditStatement(db:D1Database,actor:string|null,mess:string|null,event:string,details:string){return db.prepare('INSERT INTO audit (id,actor,mess_id,event,details,created) VALUES (?,?,?,?,?,?)').bind(crypto.randomUUID(),actor,mess,event,details,Date.now());}
