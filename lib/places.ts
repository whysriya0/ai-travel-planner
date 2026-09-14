import { z } from 'zod';
import { fetchJson, TravelError } from './http';
import { placesRequestSchema } from './types';

const placeSchema = z.object({
  id: z.string().min(1), displayName: z.object({text: z.string().min(1)}),
  location: z.object({latitude: z.number().min(-90).max(90), longitude: z.number().min(-180).max(180)}),
  rating: z.number().min(0).max(5).optional()
});
export type PlaceSearchResult = {name: string; placeId: string; lat: number; lng: number; rating?: number; photoUrl?: string; description?: string; provider?: 'google' | 'wikipedia'};

const geocodingSchema = z.object({results: z.array(z.object({
  id: z.number(), name: z.string().min(1), latitude: z.number(), longitude: z.number(),
  country: z.string().optional(), admin1: z.string().optional()
})).default([])});
const wikiPageSchema = z.object({
  pageid: z.number(), title: z.string().min(1), lat: z.number(), lon: z.number(), dist: z.number().optional()
});
const wikiDetailSchema = z.object({
  pageid: z.number(), title: z.string().min(1), description: z.string().optional(), extract: z.string().optional(),
  thumbnail: z.object({source: z.string().url()}).optional()
});

const wikiHeaders = {
  'User-Agent': 'RoamTravelPlannerBot/1.0 (https://github.com/whysriya0/ai-travel-planner)',
  'Api-User-Agent': 'RoamTravelPlannerBot/1.0 (https://github.com/whysriya0/ai-travel-planner)',
  Accept: 'application/json'
};
const unsafeTopic = /\b(attack|bomb(?:ing)?|massacre|murder|assassination|shooting|disaster|accident|crash|siege|riot|protest|pandemic|epidemic|election|campaign|battle|war|execution|victim|terror(?:ism|ist)?)\b/i;
const placeSignal = /\b(museum|gallery|park|garden|beach|mountain|lake|river|forest|trail|island|market|cafe|restaurant|bakery|square|plaza|promenade|district|quarter|neighbou?rhood|cathedral|church|temple|mosque|synagogue|palace|castle|fort|monument|memorial|tower|bridge|theatre|opera|zoo|aquarium|heritage|historic|landmark|architecture|attraction|waterfront|harbou?r)\b/i;

function radians(value:number){return value*Math.PI/180;}
function distanceKm(a:{lat:number;lon:number},b:{lat:number;lon:number}){
 const dLat=radians(b.lat-a.lat),dLon=radians(b.lon-a.lon),lat1=radians(a.lat),lat2=radians(b.lat);
 const h=Math.sin(dLat/2)**2+Math.cos(lat1)*Math.cos(lat2)*Math.sin(dLon/2)**2;
 return 6371*2*Math.atan2(Math.sqrt(h),Math.sqrt(1-h));
}

async function searchWikipediaNearby(location: string): Promise<PlaceSearchResult[]> {
  const geocodeUrl = new URL('https://geocoding-api.open-meteo.com/v1/search');
  Object.entries({name: location, count: '1', language: 'en', format: 'json'}).forEach(([key, value]) => geocodeUrl.searchParams.set(key, value));
  let geocoded: z.infer<typeof geocodingSchema>;
  try { geocoded = geocodingSchema.parse(await fetchJson<unknown>(geocodeUrl)); }
  catch (error) { throw new TravelError(`Destination lookup failed: ${error instanceof Error ? error.message : 'provider unavailable'}`); }
  const city = geocoded.results[0];
  if (!city) throw new TravelError('We could not locate that destination. Try a city and country.', 422);

  const probes=[[0,0],[.028,0],[-.028,0],[0,.038],[0,-.038]];
  let pages: Array<z.infer<typeof wikiPageSchema>>=[];
  try {
    const payloads=await Promise.all(probes.map(async([latOffset,lngOffset])=>{
      const wikiUrl = new URL('https://en.wikipedia.org/w/api.php');
      Object.entries({action:'query',format:'json',list:'geosearch',gscoord:`${city.latitude+latOffset}|${city.longitude+lngOffset}`,gsradius:'6500',gslimit:'35',gsnamespace:'0',origin:'*'}).forEach(([key,value])=>wikiUrl.searchParams.set(key,value));
      return z.object({query:z.object({geosearch:z.array(wikiPageSchema)}).optional()}).parse(await fetchJson<unknown>(wikiUrl,{headers:wikiHeaders}));
    }));
    pages=payloads.flatMap(payload=>payload.query?.geosearch||[]).filter((page,index,all)=>all.findIndex(other=>other.pageid===page.pageid)===index);
  } catch (error) { throw new TravelError(`Nearby place lookup failed: ${error instanceof Error ? error.message : 'provider unavailable'}`); }

  let details=new Map<number,z.infer<typeof wikiDetailSchema>>();
  if(pages.length){
    try{
      const detailUrl=new URL('https://en.wikipedia.org/w/api.php');
      Object.entries({action:'query',format:'json',pageids:pages.map(page=>page.pageid).join('|'),prop:'description|extracts|pageimages',exintro:'1',explaintext:'1',exchars:'280',piprop:'thumbnail',pithumbsize:'640',origin:'*'}).forEach(([key,value])=>detailUrl.searchParams.set(key,value));
      const payload=z.object({query:z.object({pages:z.record(z.string(),wikiDetailSchema)}).optional()}).parse(await fetchJson<unknown>(detailUrl,{headers:wikiHeaders}));
      details=new Map(Object.values(payload.query?.pages||{}).map(page=>[page.pageid,page]));
    }catch{/* Coordinates still allow a safe fallback when page summaries are unavailable. */}
  }
  const candidates=pages.map(page=>{
    const detail=details.get(page.pageid);const description=(detail?.description||detail?.extract||'').trim();
    const text=`${page.title} ${description}`;const distance=distanceKm({lat:city.latitude,lon:city.longitude},{lat:page.lat,lon:page.lon});
    const score=(placeSignal.test(text)?12:0)+(description?3:0)-Math.min(distance,15)/3;
    return {name:page.title,placeId:`wikipedia:${page.pageid}`,lat:page.lat,lng:page.lon,provider:'wikipedia' as const,description:description||undefined,photoUrl:detail?.thumbnail?.source,score,text};
  });
  const safe=candidates.filter(place=>!unsafeTopic.test(place.text));
  const preferred=safe.filter(place=>placeSignal.test(place.text)).sort((a,b)=>b.score-a.score);
  const remainder=safe.filter(place=>!placeSignal.test(place.text)).sort((a,b)=>b.score-a.score);
  const results=[...preferred,...remainder].slice(0,45).map(({score:_,text:__,...place})=>place);
  if (results.length) return results;
  return [{name: `${city.name} city centre`, placeId: `open-meteo:${city.id}`, lat: city.latitude, lng: city.longitude, provider: 'wikipedia'}];
}

export async function searchPlaces(query: string, location: string): Promise<PlaceSearchResult[]> {
  placesRequestSchema.parse({query, location});
  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (key) {
    try {
      const payload = await fetchJson<unknown>('https://places.googleapis.com/v1/places:searchText', {
        method: 'POST',
        headers: {'Content-Type': 'application/json', 'X-Goog-Api-Key': key, 'X-Goog-FieldMask': 'places.id,places.displayName,places.location,places.rating'},
        body: JSON.stringify({textQuery: query + ', ' + location, pageSize: 10})
      });
      const parsed = z.object({places: z.array(placeSchema).default([])}).parse(payload);
      if (parsed.places.length) return parsed.places.map(place => ({name: place.displayName.text, placeId: place.id, lat: place.location.latitude, lng: place.location.longitude, rating: place.rating, provider: 'google' as const}));
    } catch { /* The public source below keeps planning available. */ }
  }
  return searchWikipediaNearby(location);
}

