import { pbkdf2, randomBytes, createHash, timingSafeEqual } from 'node:crypto';
export const randomToken=()=>randomBytes(32).toString('hex');
export const digest=(s:string|Uint8Array)=>createHash('sha256').update(s).digest('hex');
function derive(secret:string,salt:string){return new Promise<Buffer>((resolve,reject)=>pbkdf2(secret,salt,600000,32,'sha256',(e,k)=>e?reject(e):resolve(k)));}
export async function hashSecret(secret:string){const salt=randomBytes(16).toString('hex');return `pbkdf2-sha256$600000$${salt}$${(await derive(secret,salt)).toString('hex')}`;}
export async function verifySecret(secret:string,stored:string){const [algorithm,cost,salt,hash]=stored.split('$');if(algorithm!=='pbkdf2-sha256'||cost!=='600000'||!salt||!hash)return false;const expected=Buffer.from(hash,'hex'),actual=await derive(secret,salt);return expected.length===actual.length&&timingSafeEqual(expected,actual);}
export function sameSecret(a:string,b:string){return timingSafeEqual(Buffer.from(digest(a)),Buffer.from(digest(b)));}
