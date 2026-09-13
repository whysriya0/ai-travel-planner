import test from 'node:test';
import assert from 'node:assert/strict';
import {generateItinerary, type ChatMessage} from '../lib/ollama';
import {handleApi} from '../lib/api';
import {getWeather} from '../lib/weather';
import {getDistanceTime} from '../lib/distance';
import {searchPlaces} from '../lib/places';
import {fetchJson, TravelError} from '../lib/http';
import {itineraryRequestSchema} from '../lib/types';

const date = new Date().toISOString().slice(0,10);
const input = {destination:'Paris, France',startDate:date,days:1,budget:100,travelers:2,interests:'Art'};
const places = [{placeId:'real-1',name:'Verified museum',lat:48.86,lng:2.34},{placeId:'real-2',name:'Verified park',lat:48.87,lng:2.35}];
const tools = {role:'assistant' as const,content:'',tool_calls:[
  {function:{name:'get_weather',arguments:{}}},
  {function:{name:'get_distance_time',arguments:{fromPlaceId:'real-1',toPlaceId:'real-2'}}}
]};
const final = (id='real-1',cost=10) => ({role:'assistant' as const,content:JSON.stringify({stops:[{placeId:id,day:1,category:'culture',estimatedCost:cost,reason:'See the art collection.'}],totalEstimatedCost:999,weather:[{condition:'Invented sunshine'}]})});
const deps = {places:async()=>places,weather:async()=>[],distance:async()=>({durationMinutes:5,distanceKm:1,provider:'osrm' as const,mode:'driving' as const})};
function chatSequence(sequence: ChatMessage[], inspect?: (messages:ChatMessage[])=>void) {
 let index=0;return async(messages:ChatMessage[])=>{inspect?.(messages);return {message:sequence[Math.min(index++,sequence.length-1)]};};
}
test('tool messages carry names; authoritative place data, weather and totals replace model claims',async()=>{
 let named=false;
 const result=await generateItinerary(input,{...deps,chat:chatSequence([tools,final()],messages=>{if(messages.some(m=>m.role==='tool'&&m.tool_name==='get_weather'))named=true;})});
 assert.equal(named,true);assert.equal(result.itinerary.destination,input.destination);
 assert.equal(result.itinerary.stops[0].name,'Verified museum');assert.equal(result.itinerary.totalEstimatedCost,20);assert.deepEqual(result.itinerary.weather,[]);
});
test('invalid JSON and invented IDs are repaired, never accepted',async()=>{
 const result=await generateItinerary(input,{...deps,chat:chatSequence([tools,{role:'assistant',content:'not json'},final('invented'),final()])});
 assert.equal(result.itinerary.stops[0].placeId,'real-1');
});
test('invalid tool JSON is returned to the model as a named tool error',async()=>{
 let repaired=false;
 const invalid:ChatMessage={role:'assistant',content:'',tool_calls:[{function:{name:'get_weather',arguments:'{broken'}}]};
 await generateItinerary(input,{...deps,chat:chatSequence([invalid,tools,final()],messages=>{repaired ||= messages.some(m=>m.role==='tool'&&m.content.includes('error'));})});
 assert.equal(repaired,true);
});
test('weather and routing failures preserve explicit warnings without fake forecasts',async()=>{
 const result=await generateItinerary(input,{...deps,weather:async()=>{throw new TravelError('Forecast unavailable');},distance:async()=>{throw new TravelError('No route');},chat:chatSequence([tools,final()])});
 assert.equal(result.itinerary.weather.length,0);assert.ok(result.warnings.some(w=>w.includes('Forecast unavailable')));assert.ok(result.warnings.some(w=>w.includes('No route')));
});
test('persistent invalid output exhausts bounded attempts without a Kyoto fallback',async()=>{
 let calls=0;
 await assert.rejects(generateItinerary(input,{...deps,chat:async()=>{calls++;return {message:{role:'assistant',content:'{}'}};}}),/verified itinerary/);
 assert.equal(calls,6);
});
test('over-budget plans are repaired and group totals are recomputed',async()=>{
 const result=await generateItinerary(input,{...deps,chat:chatSequence([tools,final('real-1',100),final('real-1',12)])});
 assert.equal(result.itinerary.totalEstimatedCost,24);
});
test('invalid dates, missing coordinates and empty destination are rejected',async()=>{
 assert.equal(itineraryRequestSchema.safeParse({...input,startDate:'2027-02-30'}).success,false);
 assert.equal(itineraryRequestSchema.safeParse({...input,destination:' '}).success,false);
 for(const [path,body] of [['weather',{startDate:date,days:1}],['distance',{origin:{lat:200,lng:0},destination:{lat:0,lng:0}}]]){
  const response=await handleApi(new Request('http://localhost/api/'+path,{method:'POST',body:JSON.stringify(body)}));assert.equal(response.status,400);
 }
 const malformed=await handleApi(new Request('http://localhost/api/itinerary',{method:'POST',body:'{'}));assert.equal(malformed.status,400);
});
test('future forecasts and impossible coordinates fail before any network call',async()=>{
 await assert.rejects(getWeather(48,2,'2099-01-01',1),/16 days/);
 await assert.rejects(getDistanceTime({lat:91,lng:2},{lat:48,lng:2}));
});
test('missing Google key produces a setup error instead of made-up places',async()=>{
 const prior=process.env.GOOGLE_MAPS_API_KEY;delete process.env.GOOGLE_MAPS_API_KEY;
 try{await assert.rejects(searchPlaces('museums','Paris'),/GOOGLE_MAPS_API_KEY/);}finally{if(prior)process.env.GOOGLE_MAPS_API_KEY=prior;}
});
test('provider timeout is converted to a safe actionable error',async()=>{
 const original=globalThis.fetch;
 globalThis.fetch=async()=>{throw new DOMException('Aborted','TimeoutError');};
 try{await assert.rejects(fetchJson('https://example.invalid'),/timed out/);}finally{globalThis.fetch=original;}
});
test('Google Places New adapter uses field masks and validates real place coordinates',async()=>{
 const original=globalThis.fetch,prior=process.env.GOOGLE_MAPS_API_KEY;
 process.env.GOOGLE_MAPS_API_KEY='test-only-key';
 let masked=false;
 globalThis.fetch=async(url,init)=>{
  assert.equal(String(url),'https://places.googleapis.com/v1/places:searchText');
  masked=new Headers(init?.headers).get('X-Goog-FieldMask')?.includes('places.location')||false;
  return Response.json({places:[{id:'provider-id',displayName:{text:'Museum'},location:{latitude:48.8,longitude:2.3}}]});
 };
 try{const result=await searchPlaces('museum','Paris');assert.equal(result[0].placeId,'provider-id');assert.equal(masked,true);}
 finally{globalThis.fetch=original;if(prior)process.env.GOOGLE_MAPS_API_KEY=prior;else delete process.env.GOOGLE_MAPS_API_KEY;}
});
test('final itinerary includes the driving leg for the selected activity order',async()=>{
 const response=final();const plan=JSON.parse(response.content);
 plan.stops.push({...plan.stops[0],placeId:'real-2',category:'outdoors'});response.content=JSON.stringify(plan);
 const result=await generateItinerary(input,{...deps,chat:chatSequence([tools,response])});
 assert.deepEqual(result.itinerary.legs,[{fromId:'stop-1',toId:'stop-2',durationMinutes:5,distanceKm:1,provider:'osrm',mode:'driving'}]);
});
