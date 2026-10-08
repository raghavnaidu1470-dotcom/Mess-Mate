import { env } from 'cloudflare:workers';
import { handlePortal } from '@/lib/portal-api';
import type { PortalEnv } from '@/lib/portal-db';
export const dynamic='force-dynamic';
async function handle(req:Request,context:{params:Promise<{action:string}>}){return handlePortal(req,env as PortalEnv,(await context.params).action);}
export const GET=handle;
export const POST=handle;
