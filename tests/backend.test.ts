import test from 'node:test';
import assert from 'node:assert/strict';
import {callOllama,generateItinerary, type ChatMessage} from '../lib/ollama';
import {handleApi} from '../lib/api';
import {getWeather} from '../lib/weather';
import {getDistanceTime} from '../lib/distance';
import {searchPlaces} from '../lib/places';
import {fetchJson, TravelError} from '../lib/http';
import {itineraryRequestSchema} from '../lib/types';
import {searchHotels} from '../lib/searchapi';
import {estimateFromPlaid} from '../lib/finance';
import {generatePublicItinerary} from '../lib/public-planner';

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
 const phaseOneInvalid=await handleApi(new Request('http://localhost/api/plan',{method:'POST',body:JSON.stringify({destination:'',days:1})}));assert.equal(phaseOneInvalid.status,400);
});
test('future forecasts and impossible coordinates fail before any network call',async()=>{
 await assert.rejects(getWeather(48,2,'2099-01-01',1),/16 days/);
 await assert.rejects(getDistanceTime({lat:91,lng:2},{lat:48,lng:2}));
});
test('missing Google key falls back to live geocoding and Wikipedia nearby places',async()=>{
 const original=globalThis.fetch,prior=process.env.GOOGLE_MAPS_API_KEY;delete process.env.GOOGLE_MAPS_API_KEY;
 globalThis.fetch=async url=>String(url).includes('geocoding-api.open-meteo.com')?Response.json({results:[{id:1,name:'Paris',latitude:48.85,longitude:2.35}]}):Response.json({query:{geosearch:[{pageid:10,title:'A real landmark',lat:48.86,lon:2.34,dist:200}]}});
 try{const result=await searchPlaces('museums','Paris');assert.equal(result[0].placeId,'wikipedia:10');assert.equal(result[0].provider,'wikipedia');}
 finally{globalThis.fetch=original;if(prior)process.env.GOOGLE_MAPS_API_KEY=prior;}
});
test('public place discovery removes incident pages and keeps useful descriptions',async()=>{
 const original=globalThis.fetch,prior=process.env.GOOGLE_MAPS_API_KEY;delete process.env.GOOGLE_MAPS_API_KEY;
 globalThis.fetch=async url=>{
  const value=String(url);
  if(value.includes('geocoding-api.open-meteo.com'))return Response.json({results:[{id:1,name:'Paris',latitude:48.85,longitude:2.35}]});
  if(value.includes('pageids='))return Response.json({query:{pages:{'10':{pageid:10,title:'City Garden',description:'Historic public garden in Paris'},'11':{pageid:11,title:'City bombing attempt',description:'Failed bombing attack'}}}});
  return Response.json({query:{geosearch:[{pageid:10,title:'City Garden',lat:48.86,lon:2.34,dist:200},{pageid:11,title:'City bombing attempt',lat:48.861,lon:2.341,dist:220}]}});
 };
 try{const result=await searchPlaces('parks','Paris');assert.deepEqual(result.map(place=>place.name),['City Garden']);assert.equal(result[0].description,'Historic public garden in Paris');}
 finally{globalThis.fetch=original;if(prior)process.env.GOOGLE_MAPS_API_KEY=prior;}
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
test('public planner covers every requested day and stays inside the group budget',async()=>{
 const publicPlaces=Array.from({length:9},(_,index)=>({placeId:`wiki-${index}`,name:`Landmark ${index+1}`,lat:48.85+index/1000,lng:2.35+index/1000,description:'A documented local landmark.'}));
 const result=await generatePublicItinerary({...input,days:3,budget:90},{places:async()=>publicPlaces,weather:async()=>[],distance:async()=>({durationMinutes:8,distanceKm:1.2,provider:'osrm' as const,mode:'driving' as const})});
 assert.deepEqual([...new Set(result.itinerary.stops.map(stop=>stop.day))],[1,2,3]);
 assert.ok(result.itinerary.totalEstimatedCost<=90);assert.equal(result.backend,'roam-guide');assert.equal(result.itinerary.legs?.length,6);
});
test('OmniRoute uses the OpenAI-compatible Astra path without exposing a provider key',async()=>{
 const originalFetch=globalThis.fetch;
 const prior={backend:process.env.AI_BACKEND,url:process.env.OMNIROUTE_URL,key:process.env.OMNIROUTE_API_KEY,model:process.env.OMNIROUTE_MODEL};
 process.env.AI_BACKEND='omniroute';process.env.OMNIROUTE_URL='http://omniroute.test';process.env.OMNIROUTE_API_KEY='test-key';process.env.OMNIROUTE_MODEL='azure/gpt-6-astra';
 let requestBody:Record<string,unknown>|undefined;let auth='';
 globalThis.fetch=async(url,init)=>{assert.equal(String(url),'http://omniroute.test/v1/chat/completions');requestBody=JSON.parse(String(init?.body));auth=new Headers(init?.headers).get('Authorization')||'';return Response.json({choices:[{message:{role:'assistant',content:'{}'}}]});};
 try{const result=await callOllama([{role:'user',content:'test'}]);assert.equal(result.message?.content,'{}');assert.equal(requestBody?.model,'azure/gpt-6-astra');assert.equal(requestBody?.max_completion_tokens,2400);assert.equal(requestBody?.max_tokens,undefined);assert.equal(auth,'Bearer test-key');}
 finally{globalThis.fetch=originalFetch;for(const [name,value] of Object.entries(prior)){if(value===undefined)delete process.env[{backend:'AI_BACKEND',url:'OMNIROUTE_URL',key:'OMNIROUTE_API_KEY',model:'OMNIROUTE_MODEL'}[name]!];else process.env[{backend:'AI_BACKEND',url:'OMNIROUTE_URL',key:'OMNIROUTE_API_KEY',model:'OMNIROUTE_MODEL'}[name] as string]=value;}}
});
test('SearchApi hotel results are ranked by review quality and price value',async()=>{
 const original=globalThis.fetch,prior=process.env.SEARCHAPI_API_KEY;process.env.SEARCHAPI_API_KEY='test-key';
 globalThis.fetch=async()=>Response.json({search_parameters:{currency:'USD'},properties:[
  {name:'Expensive Five',overall_rating:5,reviews:10,rate_per_night:{extracted_lowest:450}},
  {name:'Loved Local',overall_rating:4.8,reviews:2400,rate_per_night:{extracted_lowest:150}}
 ]});
 try{const hotels=await searchHotels({destination:'Paris',startDate:date,days:3,travelers:2,budget:1800});assert.equal(hotels[0].name,'Loved Local');assert.equal(hotels[0].pricePerNight,150);}
 finally{globalThis.fetch=original;if(prior)process.env.SEARCHAPI_API_KEY=prior;else delete process.env.SEARCHAPI_API_KEY;}
});
test('Plaid estimate returns only a bounded summary and never invents a credit score',async()=>{
 const original=globalThis.fetch,priorId=process.env.PLAID_CLIENT_ID,priorSecret=process.env.PLAID_SECRET;process.env.PLAID_CLIENT_ID='id';process.env.PLAID_SECRET='secret';
 globalThis.fetch=async url=>String(url).endsWith('/item/public_token/exchange')?Response.json({access_token:'access'}):String(url).endsWith('/transactions/get')?Response.json({transactions:[{amount:90,date,category:['Food'],pending:false},{amount:2000,date,category:['Rent'],pending:false}]}):Response.json({accounts:[{type:'credit',balances:{available:1200,current:300,limit:1500}}]});
 try{const estimate=await estimateFromPlaid('public-token',5,2000);assert.equal(estimate.averageDailyDiscretionarySpend,1);assert.equal(estimate.recommendedTripSpend,100);assert.match(estimate.disclaimer,/does not retrieve or infer your credit score/);assert.equal('transactions' in estimate,false);}
 finally{globalThis.fetch=original;if(priorId)process.env.PLAID_CLIENT_ID=priorId;else delete process.env.PLAID_CLIENT_ID;if(priorSecret)process.env.PLAID_SECRET=priorSecret;else delete process.env.PLAID_SECRET;}
});

