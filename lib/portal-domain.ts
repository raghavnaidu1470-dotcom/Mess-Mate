export const SLOTS=['breakfast','lunch','snacks','dinner'] as const;
export type Slot=typeof SLOTS[number];
export type Role='student'|'incharge'|'warden';
export type Item={name:string;portion?:string;nutrition?:{calories:number;protein:number;carbs:number;fat:number;source:string}};
export function indiaDate(now=Date.now()){return new Date(now+330*60000).toISOString().slice(0,10);}
export function monthWindow(now=Date.now()){
  const date=indiaDate(now),year=+date.slice(0,4),month=+date.slice(5,7),day=+date.slice(8,10);
  const last=new Date(Date.UTC(year,month,0)).getUTCDate();
  return {month:date.slice(0,7),open:day>=last-6,opens:`${date.slice(0,7)}-${String(last-6).padStart(2,'0')}`,closes:`${date.slice(0,7)}-${last}`,previous:new Date(Date.UTC(year,month-2,1)).toISOString().slice(0,7)};
}
export function validDate(value:string){return /^\d{4}-\d{2}-\d{2}$/.test(value)&&!Number.isNaN(Date.parse(value))&&new Date(value).toISOString().slice(0,10)===value;}
export function canAccessMess(user:{role:Role;mess_id:string|null},messId:string){return user.role==='warden'||user.mess_id===messId;}
export function studentEmail(value:string){return /^[a-z]+(?:\.[a-z]+)+20\d{2}@vitstudent\.ac\.in$/.test(value);}
