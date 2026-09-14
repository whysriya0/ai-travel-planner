import type {ItineraryRequest} from './types';
import {backendName,generateItinerary} from './ollama';
import {generatePublicItinerary} from './public-planner';

const modelIsConfigured=()=>backendName()==='omniroute'?Boolean(process.env.OMNIROUTE_URL):Boolean(process.env.AI_BACKEND==='ollama'||process.env.OLLAMA_URL);

export async function createItinerary(input:ItineraryRequest){
 if(modelIsConfigured()){
   try{return await generateItinerary(input);}catch(error){
     const result=await generatePublicItinerary(input);
     result.warnings.unshift(`The AI model was unavailable, so Roam completed this plan with live public travel data${error instanceof Error?`: ${error.message}`:'.'}`);
     return result;
   }
 }
 return generatePublicItinerary(input);
}


