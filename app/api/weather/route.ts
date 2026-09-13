import {NextResponse} from 'next/server';
import {getWeather} from '@/lib/weather';
import {z} from 'zod';
const requestSchema=z.object({lat:z.coerce.number(),lng:z.coerce.number(),startDate:z.string().regex(/^\d{4}-\d{2}-\d{2}$/),days:z.coerce.number().int().min(1).max(14)});
export async function POST(request:Request){try{const parsed=requestSchema.safeParse(await request.json());if(!parsed.success)return NextResponse.json({error:'lat, lng, startDate and days are required.'},{status:400});return NextResponse.json({weather:await getWeather(parsed.data.lat,parsed.data.lng,parsed.data.startDate,parsed.data.days)},{headers:{'Cache-Control':'no-store'}})}catch(error){return NextResponse.json({error:error instanceof Error?error.message:'Weather lookup failed.'},{status:502})}}

