import { pbkdf2Sync,randomBytes } from 'node:crypto';
const password=process.env.MESSMATE_WARDEN_PASSWORD;
if(!password||password.length<12){console.error('Provide MESSMATE_WARDEN_PASSWORD with at least 12 characters through a secure environment.');process.exit(1);}
const salt=randomBytes(16).toString('hex');
console.log(`pbkdf2-sha256$600000$${salt}$${pbkdf2Sync(password,salt,600000,32,'sha256').toString('hex')}`);
