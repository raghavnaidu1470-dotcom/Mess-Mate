import Portal from '@/components/vit-portal';
import { notFound } from 'next/navigation';
import { SLOTS,validDate } from '@/lib/portal-domain';
export default async function MealPage({params}:{params:Promise<{slug:string;date:string;meal:string}>}){const route=await params;if(!validDate(route.date)||!SLOTS.includes(route.meal as typeof SLOTS[number]))notFound();return <Portal route={route}/>;}
