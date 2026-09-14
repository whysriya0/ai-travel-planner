import {z} from 'zod';
import {fetchJson,TravelError} from './http';

export type FlightOption={airline:string;price:number;currency:string;durationMinutes?:number;departure:string;arrival:string;stops:number;bookingToken?:string};
export type HotelOption={name:string;pricePerNight:number;currency:string;rating?:number;reviews?:number;hotelClass?:number;link?:string;image?:string;valueScore:number};

async function searchApi(params:Record<string,string|number>){
 const key=process.env.SEARCHAPI_API_KEY;if(!key)throw new TravelError('Flight and hotel search is not configured.',503);
 const url=new URL('https://www.searchapi.io/api/v1/search');Object.entries(params).forEach(([name,value])=>url.searchParams.set(name,String(value)));
 return fetchJson<unknown>(url,{headers:{Authorization:`Bearer ${key}`}},25000);
}
async function flightLocation(query:string,searchType:'departure'|'arrival'){
 const payload=await searchApi({engine:'google_flights_location_search',q:query,search_type:searchType,hl:'en-US'});
 const airport=z.object({airport_code:z.string().length(3)});const location=z.object({kgmid:z.string().optional(),airports:z.array(airport).optional()});
 const parsed=z.object({locations:z.array(location).min(1)}).parse(payload);const first=parsed.locations[0];
 return first.kgmid||first.airports?.[0]?.airport_code||(()=>{throw new TravelError(`No flight location found for ${query}.`,422)})();
}
export async function searchFlights(input:{origin:string;destination:string;startDate:string;days:number;travelers:number;currency?:string}):Promise<FlightOption[]>{
 const departureId=await flightLocation(input.origin,'departure'),arrivalId=await flightLocation(input.destination,'arrival');
 const end=new Date(input.startDate+'T00:00:00Z');end.setUTCDate(end.getUTCDate()+input.days);
 const payload=await searchApi({engine:'google_flights',flight_type:'round_trip',departure_id:departureId,arrival_id:arrivalId,outbound_date:input.startDate,return_date:end.toISOString().slice(0,10),adults:Math.min(9,input.travelers),currency:input.currency||'USD',hl:'en-US'});
 const leg=z.object({airline:z.string().optional(),departure_airport:z.object({id:z.string().optional()}).optional(),arrival_airport:z.object({id:z.string().optional()}).optional()});
 const result=z.object({price:z.number(),total_duration:z.number().optional(),flights:z.array(leg).default([]),booking_token:z.string().optional()});
 const parsed=z.object({best_flights:z.array(result).default([]),other_flights:z.array(result).default([]),search_parameters:z.object({currency:z.string().default(input.currency||'USD')}).optional()}).parse(payload);
 return [...parsed.best_flights,...parsed.other_flights].slice(0,6).map(item=>({airline:item.flights[0]?.airline||'Multiple airlines',price:item.price,currency:parsed.search_parameters?.currency||input.currency||'USD',durationMinutes:item.total_duration,departure:item.flights[0]?.departure_airport?.id||departureId,arrival:item.flights.at(-1)?.arrival_airport?.id||arrivalId,stops:Math.max(0,item.flights.length-1),bookingToken:item.booking_token}));
}
export async function searchHotels(input:{destination:string;startDate:string;days:number;travelers:number;budget:number;currency?:string}):Promise<HotelOption[]>{
 const checkout=new Date(input.startDate+'T00:00:00Z');checkout.setUTCDate(checkout.getUTCDate()+input.days);
 const nightlyCeiling=Math.max(50,Math.floor((input.budget*.55)/Math.max(1,input.days)));
 const payload=await searchApi({engine:'google_hotels',q:`Hotels in ${input.destination}`,check_in_date:input.startDate,check_out_date:checkout.toISOString().slice(0,10),adults:Math.min(6,input.travelers),currency:input.currency||'USD',sort_by:'highest_rating',price_max:nightlyCeiling,property_type:'hotel',hl:'en-US'});
 const property=z.object({name:z.string(),overall_rating:z.number().optional(),reviews:z.number().optional(),hotel_class:z.number().optional(),link:z.string().url().optional(),images:z.array(z.object({thumbnail:z.string().url().optional(),original_image:z.string().url().optional()})).optional(),rate_per_night:z.object({extracted_lowest:z.number().optional(),lowest:z.string().optional()}).optional()});
 const parsed=z.object({properties:z.array(property).default([]),search_parameters:z.object({currency:z.string().default(input.currency||'USD')}).optional()}).parse(payload);
 return parsed.properties.map(item=>{const price=item.rate_per_night?.extracted_lowest||Number(item.rate_per_night?.lowest?.replace(/[^0-9.]/g,''))||0;const rating=item.overall_rating||0;const valueScore=Math.round((rating*20+Math.log10((item.reviews||0)+1)*8-Math.min(35,price/nightlyCeiling*20))*10)/10;return {name:item.name,pricePerNight:price,currency:parsed.search_parameters?.currency||input.currency||'USD',rating:item.overall_rating,reviews:item.reviews,hotelClass:item.hotel_class,link:item.link,image:item.images?.[0]?.original_image||item.images?.[0]?.thumbnail,valueScore};}).filter(item=>item.pricePerNight>0).sort((a,b)=>b.valueScore-a.valueScore).slice(0,6);
}

