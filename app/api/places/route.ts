import {NextResponse} from 'next/server';
import {searchPlaces} from '@/lib/places';
import {z} from 'zod';
const requestSchema=z.object({query:z.string().trim().min(2).max(120),location:z.string().trim().min(2).max(120)});
export async function POST(request:Request){try{const parsed=requestSchema.safeParse(await request.json());if(!parsed.success)return NextResponse.json({error:'query and location are required.'},{status:400});return NextResponse.json({places:await searchPlaces(parsed.data.query,parsed.data.location)},{headers:{'Cache-Control':'no-store'}})}catch(error){return NextResponse.json({error:error instanceof Error?error.message:'Places lookup failed.'},{status:502})}}

