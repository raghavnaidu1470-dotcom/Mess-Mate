import { z } from 'zod';
import { SLOTS } from './portal-domain';
import { withNutrition } from './nutrition-reference';
const feedSchema=z.object({hostel:z.number(),mess:z.number(),menu:z.array(z.object({date:z.string().regex(/^\d{4}-\d{2}-\d{2}$/),menu:z.array(z.object({type:z.number().int().min(1).max(4),menu:z.string().min(1)}))}))});
export async function fetchMessit(hostel:number,category:number,month:string){
 const source=`https://messit.vinnovateit.com/menu-data/hostel-${hostel}-mess-${category}.json`;
 const response=await fetch(source,{signal:AbortSignal.timeout(15000),redirect:'error'});if(!response.ok)throw new Error('MessIT is unavailable');
 const raw=await response.text();if(raw.length>1000000)throw new Error('Menu feed too large');const data=feedSchema.parse(JSON.parse(raw));
 if(data.hostel!==hostel||data.mess!==category)throw new Error('Feed identity mismatch');
 const meals=data.menu.filter(day=>day.date.startsWith(month+'-')).flatMap(day=>{
 const weekend=[0,6].includes(new Date(day.date+'T12:00:00+05:30').getUTCDay());
 return day.menu.map(m=>({date:day.date,slot:SLOTS[m.type-1],start:m.type===1?(weekend?'07:30':'07:00'):m.type===2?'12:30':m.type===3?'16:30':'19:00',end:m.type===1?(weekend?'09:30':'09:00'):m.type===2?'14:30':m.type===3?'18:15':'21:00',items:m.menu.split(',').map(name=>({name:name.trim()})).filter(i=>i.name)}));});
 return {source,meals:meals.map(meal=>({...meal,items:meal.items.map(withNutrition)}))};
}
