export type PlaceSearchResult={name:string;placeId:string;lat:number;lng:number;rating?:number;photoUrl?:string};

type GooglePlace={name?:string;place_id?:string;geometry?:{location?:{lat?:number;lng?:number}};rating?:number;photos?:Array<{photo_reference?:string}>};

export async function searchPlaces(query:string,location:string):Promise<PlaceSearchResult[]>{
 const key=process.env.GOOGLE_MAPS_API_KEY;
 if(key){
  const url=new URL('https://maps.googleapis.com/maps/api/place/textsearch/json');
  url.searchParams.set('query',`${query}, ${location}`);url.searchParams.set('key',key);
  const response=await fetch(url,{cache:'no-store'});
  if(response.ok){
   const payload=await response.json() as {results?:GooglePlace[]};
   const places=(payload.results??[]).map((place):PlaceSearchResult|null=>{const lat=place.geometry?.location?.lat,lng=place.geometry?.location?.lng;if(!place.name||!place.place_id||typeof lat!=='number'||typeof lng!=='number')return null;return {name:place.name,placeId:place.place_id,lat,lng,rating:place.rating}}).filter((place):place is PlaceSearchResult=>Boolean(place));
   if(places.length)return places;
  }
 }
 const url=new URL('https://nominatim.openstreetmap.org/search');url.searchParams.set('q',`${query}, ${location}`);url.searchParams.set('format','jsonv2');url.searchParams.set('limit','6');
 const response=await fetch(url,{headers:{'User-Agent':'Roam travel planner demo'},cache:'no-store'});
 if(response.ok){
  const payload=await response.json() as Array<{display_name?:string;lat?:string;lon?:string;osm_type?:string;osm_id?:number}>;
  const places=payload.map((place):PlaceSearchResult|null=>{const lat=Number(place.lat),lng=Number(place.lon);if(!place.display_name||!Number.isFinite(lat)||!Number.isFinite(lng))return null;return {name:place.display_name.split(',')[0],placeId:`${place.osm_type??'osm'}:${place.osm_id??place.display_name}`,lat,lng}}).filter((place):place is PlaceSearchResult=>Boolean(place));
  if(places.length)return places;
 }
 return [{name:location,placeId:`local:${location.toLowerCase().replace(/[^a-z0-9]+/g,'-')}`,lat:0,lng:0}];
}

