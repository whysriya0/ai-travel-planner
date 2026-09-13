export type Coordinate={lat:number;lng:number};
export type DistanceResult={durationMinutes:number;distanceKm:number;provider:'google'|'osrm'};

export async function getDistanceTime(origin:Coordinate,destination:Coordinate):Promise<DistanceResult>{
 if(!Number.isFinite(origin.lat)||!Number.isFinite(origin.lng)||!Number.isFinite(destination.lat)||!Number.isFinite(destination.lng))throw new Error('Distance coordinates must be finite numbers.');
 const key=process.env.GOOGLE_MAPS_API_KEY;
 if(key){
  const url=new URL('https://maps.googleapis.com/maps/api/distancematrix/json');url.searchParams.set('origins',`${origin.lat},${origin.lng}`);url.searchParams.set('destinations',`${destination.lat},${destination.lng}`);url.searchParams.set('units','metric');url.searchParams.set('key',key);
  const response=await fetch(url,{cache:'no-store'});if(response.ok){const payload=await response.json() as {rows?:Array<{elements?:Array<{status?:string,duration?:{value?:number},distance?:{value?:number}}>}>};const element=payload.rows?.[0]?.elements?.[0];if(element?.status==='OK'&&typeof element.duration?.value==='number'&&typeof element.distance?.value==='number')return {durationMinutes:Math.max(1,Math.round(element.duration.value/60)),distanceKm:Math.round(element.distance.value/100)/10,provider:'google'};}
 }
 const url=`https://router.project-osrm.org/route/v1/driving/${origin.lng},${origin.lat};${destination.lng},${destination.lat}?overview=false`;
 const response=await fetch(url,{headers:{'User-Agent':'Roam travel planner demo'},cache:'no-store'});if(!response.ok)throw new Error(`Routing provider returned ${response.status}`);const payload=await response.json() as {routes?:Array<{duration?:number;distance?:number}>};const route=payload.routes?.[0];if(!route||typeof route.duration!=='number'||typeof route.distance!=='number')throw new Error('No route found.');return {durationMinutes:Math.max(1,Math.round(route.duration/60)),distanceKm:Math.round(route.distance/100)/10,provider:'osrm'};
}

