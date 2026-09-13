import {itinerarySchema,type Itinerary,type ItineraryRequest} from './types';
import {searchPlaces,type PlaceSearchResult} from './places';
import {getWeather} from './weather';
import {journey} from './travel/sample-journey';

type ChatMessage={role:'system'|'user'|'assistant'|'tool';content:string;tool_calls?:Array<{function:{name:string;arguments:Record<string,unknown>|string}}>};
type OllamaResponse={message?:ChatMessage};
type AgentResult={itinerary:Itinerary;source:'ollama'|'fallback';model:string;warning?:string};
const ollamaUrl=()=>process.env.OLLAMA_URL??'http://localhost:11434';
const ollamaModel=()=>process.env.OLLAMA_MODEL??'qwen2.5:14b';
const toolSchemas=[
 {type:'function',function:{name:'search_places',description:'Find real places for a destination. Always use this before inventing a placeId or coordinates.',parameters:{type:'object',properties:{query:{type:'string'},location:{type:'string'}},required:['query','location']}}},
 {type:'function',function:{name:'get_weather',description:'Get a daily forecast. Use it before finalizing outdoor activities and mention weather-aware choices in each stop reason.',parameters:{type:'object',properties:{lat:{type:'number'},lng:{type:'number'},startDate:{type:'string'},days:{type:'integer'}},required:['lat','lng','startDate','days']}}}
];
const schemaText=JSON.stringify({destination:'string',days:'integer',stops:[{id:'string',day:'integer',name:'string',placeId:'string',lat:'number',lng:'number',category:'string',estimatedCost:'number',reason:'string',rating:'number?'}],weather:[{day:'integer',date:'YYYY-MM-DD',condition:'string',tempHighC:'number',tempLowC:'number',precipitationChance:'number'}],totalEstimatedCost:'number'});

function extractJson(text:string){const cleaned=text.trim().replace(/^```(?:json)?/i,'').replace(/```$/,'').trim();const first=cleaned.indexOf('{'),last=cleaned.lastIndexOf('}');return first>=0&&last>first?cleaned.slice(first,last+1):cleaned;}
function fallback(input:ItineraryRequest,place:PlaceSearchResult,weather:Awaited<ReturnType<typeof getWeather>>):Itinerary{const source=journey.slice(0,Math.min(input.days,journey.length));const stops=source.flatMap((day,dayIndex)=>day.stops.map((stop,index)=>({id:`fallback-${dayIndex+1}-${index+1}-${stop.id}`,day:dayIndex+1,name:stop.name,placeId:index===0?place.placeId:`sample:${stop.id}`,lat:index===0?place.lat:stop.lat,lng:index===0?place.lng:stop.lng,category:stop.category,estimatedCost:stop.estimatedCost,reason:`Sample fallback for ${input.destination}. ${stop.reason}`,rating:undefined})));return {destination:input.destination,days:source.length,stops,weather,totalEstimatedCost:stops.reduce((sum,stop)=>sum+stop.estimatedCost*input.travelers,0)};}
async function callOllama(messages:ChatMessage[]){const response=await fetch(`${ollamaUrl()}/api/chat`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({model:ollamaModel(),messages,tools:toolSchemas,stream:false,format:'json',options:{temperature:0.2}})});if(!response.ok)throw new Error(`Ollama returned ${response.status}`);return await response.json() as OllamaResponse;}

export async function generateItinerary(input:ItineraryRequest):Promise<AgentResult>{
 const model=ollamaModel();let place:PlaceSearchResult={name:input.destination,placeId:`local:${input.destination}`,lat:0,lng:0};let weather:Awaited<ReturnType<typeof getWeather>>=[];
 try{const places=await searchPlaces(input.destination,input.destination);place=places[0]??place;weather=await getWeather(place.lat,place.lng,input.startDate,input.days);}catch(error){console.warn('Travel data providers unavailable',error);}
 const system=`You are Roam, a careful local travel planner. Respond with ONLY valid JSON matching this exact schema and no markdown: ${schemaText}. Use the supplied tools for real place and weather data. Every stop must have a real tool-backed placeId or a clearly labeled sample: id. Use weather results to justify outdoor or indoor choices in reason. Keep the total within the requested budget when possible.`;
 const messages:ChatMessage[]=[{role:'system',content:system},{role:'user',content:JSON.stringify({request:input,resolvedDestination:place,initialWeather:weather})}];
 try{
  for(let attempt=0;attempt<6;attempt++){
   const result=await callOllama(messages);const message=result.message;if(!message)throw new Error('Ollama returned no message');messages.push(message);
   if(message.tool_calls?.length){for(const call of message.tool_calls){const args=typeof call.function.arguments==='string'?JSON.parse(call.function.arguments):call.function.arguments;let value:unknown;if(call.function.name==='search_places')value=await searchPlaces(String(args.query??input.destination),String(args.location??input.destination));else if(call.function.name==='get_weather')value=await getWeather(Number(args.lat),Number(args.lng),String(args.startDate??input.startDate),Math.max(1,Math.min(14,Number(args.days??input.days))));else value={error:`Unknown tool ${call.function.name}`};messages.push({role:'tool',content:JSON.stringify(value)});}continue;}
   const parsed=itinerarySchema.safeParse(JSON.parse(extractJson(message.content)));if(parsed.success)return {itinerary:parsed.data,source:'ollama',model};messages.push({role:'user',content:`Your previous JSON failed validation: ${parsed.error.message}. Return only corrected JSON matching the schema.`});
  }
 }catch(error){console.warn('Ollama itinerary generation failed',error);}
 return {itinerary:fallback(input,place,weather),source:'fallback',model,warning:'Local Ollama was unavailable or returned invalid JSON, so Roam served its safe sample itinerary.'};
}

