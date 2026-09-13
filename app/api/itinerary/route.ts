import {NextResponse} from 'next/server';
import {generateItinerary} from '@/lib/ollama';
import {itineraryRequestSchema} from '@/lib/types';

export async function POST(request:Request){
 try{
  const body=await request.json();const parsed=itineraryRequestSchema.safeParse(body);
  if(!parsed.success)return NextResponse.json({error:'Please provide a destination, start date, trip length and valid preferences.',issues:parsed.error.flatten()},{status:400});
  const result=await generateItinerary(parsed.data);
  return NextResponse.json(result,{headers:{'Cache-Control':'no-store'}});
 }catch(error){return NextResponse.json({error:error instanceof Error?error.message:'Unable to create itinerary.'},{status:500});}
}

