import {NextResponse} from 'next/server';
import {getDistanceTime} from '@/lib/distance';
import {z} from 'zod';
const coordinate=z.object({lat:z.coerce.number(),lng:z.coerce.number()});
const requestSchema=z.object({origin:coordinate,destination:coordinate});
export async function POST(request:Request){try{const parsed=requestSchema.safeParse(await request.json());if(!parsed.success)return NextResponse.json({error:'origin and destination coordinates are required.'},{status:400});return NextResponse.json(await getDistanceTime(parsed.data.origin,parsed.data.destination),{headers:{'Cache-Control':'no-store'}})}catch(error){return NextResponse.json({error:error instanceof Error?error.message:'Distance lookup failed.'},{status:502})}}

