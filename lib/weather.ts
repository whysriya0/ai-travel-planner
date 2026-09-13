import type {DayWeather} from './types';

type OpenMeteoPayload={daily?:{time?:string[];temperature_2m_max?:number[];temperature_2m_min?:number[];precipitation_probability_max?:number[];weather_code?:number[]}};
const condition=(code:number|undefined)=>{if(typeof code!=='number')return 'Forecast pending';if(code===0)return 'Clear skies';if(code<=3)return 'Partly cloudy';if(code<=48)return 'Misty';if(code<=67)return 'Rain possible';if(code<=77)return 'Snow possible';if(code<=82)return 'Showers';return 'Storm risk'};

export async function getWeather(lat:number,lng:number,startDate:string,days:number):Promise<DayWeather[]>{
 if(!Number.isFinite(lat)||!Number.isFinite(lng)||lat===0&&lng===0)return [];
 const end=new Date(`${startDate}T12:00:00`);end.setDate(end.getDate()+days-1);
 const url=new URL('https://api.open-meteo.com/v1/forecast');url.searchParams.set('latitude',String(lat));url.searchParams.set('longitude',String(lng));url.searchParams.set('daily','temperature_2m_max,temperature_2m_min,precipitation_probability_max,weather_code');url.searchParams.set('start_date',startDate);url.searchParams.set('end_date',end.toISOString().slice(0,10));url.searchParams.set('timezone','auto');
 const response=await fetch(url,{cache:'no-store'});if(!response.ok)throw new Error(`Weather provider returned ${response.status}`);
 const payload=await response.json() as OpenMeteoPayload;const daily=payload.daily;if(!daily?.time)return [];
 return daily.time.map((date,index)=>({day:index+1,date,condition:condition(daily.weather_code?.[index]),tempHighC:Math.round(daily.temperature_2m_max?.[index]??0),tempLowC:Math.round(daily.temperature_2m_min?.[index]??0),precipitationChance:Math.round(daily.precipitation_probability_max?.[index]??0)}));
}

