import type {AgentResult} from './ollama';
import {enrichWikipediaPlaces,searchPlaces, type PlaceSearchResult} from './places';
import {getWeather} from './weather';
import {getDistanceTime} from './distance';
import type {AgentTraceEvent, DayWeather, Itinerary, ItineraryRequest} from './types';

type PublicDependencies={places:typeof searchPlaces;enrich:typeof enrichWikipediaPlaces;weather:typeof getWeather;distance:typeof getDistanceTime};
function categoryFor(place:PlaceSearchResult){
 const text=(place.name+' '+(place.description||'')).toLowerCase();
 if(/park|garden|beach|hill|mountain|lake|river|forest|trail|island/.test(text))return 'outdoors';
 if(/market|cafe|coffee|food|restaurant|bakery|culinary/.test(text))return 'food';
 if(/spa|bath|promenade|neighbou?rhood|district|quarter|square|plaza|waterfront|harbou?r/.test(text))return 'rest';
 return 'culture';
}
function arrangePlaces(places:PlaceSearchResult[],count:number){
 const order=['culture','outdoors','food','rest'] as const;
 const buckets=new Map(order.map(category=>[category,places.filter(place=>categoryFor(place)===category)]));
 const chosen:PlaceSearchResult[]=[];
 while(chosen.length<count){
  let added=false;
  for(const category of order){const place=buckets.get(category)?.shift();if(place){chosen.push(place);added=true;if(chosen.length===count)break;}}
  if(!added)break;
 }
 return chosen;
}
function reasonFor(place:PlaceSearchResult,interests:string,category:string){
 const detail=place.description?.split(/(?<=[.!?])\s/)[0]?.slice(0,220);
 if(detail)return detail;
 const preference=interests.trim()?` and fits your interest in ${interests.trim().slice(0,90)}`:'';
 return category==='rest'?`A slower pause in ${place.name} to keep the day comfortable${preference}.`:`A well-known local stop that adds character to the day${preference}.`;
}

export async function generatePublicItinerary(input:ItineraryRequest,overrides:Partial<PublicDependencies>={}):Promise<AgentResult>{
 const deps={places:searchPlaces,enrich:enrichWikipediaPlaces,weather:getWeather,distance:getDistanceTime,...overrides};
 const trace:AgentTraceEvent[]=[];
 const log=(agent:AgentTraceEvent['agent'],action:string,detail:string,status:AgentTraceEvent['status']='complete')=>trace.push({agent,action,detail,status,timestamp:Date.now()});
 log('Supervisor','start',`Building a live ${input.days}-day journey in ${input.destination}.`,'running');
 const places=await deps.places(input.interests||'things to do',input.destination);
 if(!places.length)throw new Error('No places were found for this destination.');
 log('Local Expert','discover',`Found ${places.length} nearby places from live public data.`);
 const stopsPerDay=Math.min(3,Math.max(1,Math.floor(Math.min(places.length,input.days*3)/input.days)));
 const stopCount=stopsPerDay*input.days;
 const selectedPlaces=await deps.enrich(arrangePlaces(places,stopCount));
 const maxPerPerson=Math.max(0,Math.floor(input.budget/input.travelers/stopCount));
 const baseCosts={culture:18,outdoors:4,rest:10,food:20};
 const stops=Array.from({length:stopCount},(_,index)=>{
   const place=selectedPlaces[index];
   const category=categoryFor(place);
   return {...place,id:`stop-${index+1}`,day:Math.floor(index/stopsPerDay)+1,category,estimatedCost:Math.min(baseCosts[category],maxPerPerson),reason:reasonFor(place,input.interests,category)};
 });
 let weather:DayWeather[]=[];const warnings=new Set<string>();
 try{weather=await deps.weather(stops[0].lat,stops[0].lng,input.startDate,input.days);log('Tool','weather',`Checked ${input.days} days with Open-Meteo.`);}catch(error){warnings.add(error instanceof Error?error.message:'Weather is not available yet.');}
 const legs:NonNullable<Itinerary['legs']>=[];
 for(let index=1;index<stops.length;index++){
   const from=stops[index-1],to=stops[index];if(from.day!==to.day)continue;
   try{legs.push({fromId:from.id,toId:to.id,...await deps.distance(from,to)});}catch{warnings.add(`Driving route unavailable between ${from.name} and ${to.name}.`);}
 }
 const totalEstimatedCost=Math.round(stops.reduce((sum,stop)=>sum+stop.estimatedCost*input.travelers,0)*100)/100;
 const publicPlaces=places.some(place=>place.provider==='wikipedia');
 warnings.add(`${publicPlaces?'Places come from Wikipedia Nearby.':'Places come from Google Places.'} Confirm opening hours and admission prices before visiting.`);
 log('Supervisor','assemble',`Arranged ${stops.length} live places across every requested day.`);
 log('Supervisor','complete','Your route is ready.');
 return {itinerary:{destination:input.destination,days:input.days,stops,weather,totalEstimatedCost,legs},source:'roam-guide',backend:'roam-guide',model:'live public data',warnings:[...warnings],toolsUsed:[publicPlaces?'wikipedia-nearby':'google-places','open-meteo-weather','osrm'],trace};
}

