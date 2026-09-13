// Live Ollama + live weather/routing; place search uses explicit test fixtures.
import {build} from 'rolldown';
await build({input:'lib/ollama.ts',platform:'node',output:{file:'work/ollama-smoke-agent.mjs',format:'esm'}});
const {generateItinerary,callOllama}=await import('../work/ollama-smoke-agent.mjs');
const started=Date.now();
console.log('Testing live Ollama with fixture places; this does not verify Google Places.');
const result=await generateItinerary({destination:'Paris, France',startDate:new Date().toISOString().slice(0,10),days:1,budget:100,travelers:1,interests:'A museum and a slow walk'}, {
 chat:async (messages,finalize)=>{const result=await callOllama(messages,finalize);console.log('Model response:',JSON.stringify(result.message));return result;},
 places:async()=>[
  {placeId:'fixture-louvre',name:'Louvre (test fixture)',lat:48.8606,lng:2.3376},
  {placeId:'fixture-tuileries',name:'Tuileries (test fixture)',lat:48.8635,lng:2.3275}
 ]
});
console.log(JSON.stringify({elapsedSeconds:Math.round((Date.now()-started)/1000),...result},null,2));
