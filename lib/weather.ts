import { z } from 'zod';
import { fetchJson, TravelError } from './http';
import { weatherRequestSchema, type DayWeather } from './types';
const condition = (code: number) => code === 0 ? 'Clear skies' : code <= 3 ? 'Partly cloudy' : code <= 48 ? 'Fog' : code <= 67 ? 'Rain' : code <= 77 ? 'Snow' : code <= 82 ? 'Showers' : code <= 86 ? 'Snow showers' : 'Thunderstorms';
export async function getWeather(lat: number, lng: number, startDate: string, days: number): Promise<DayWeather[]> {
  weatherRequestSchema.parse({lat, lng, startDate, days});
  const start = new Date(startDate + 'T00:00:00Z');
  const today = new Date(new Date().toISOString().slice(0,10) + 'T00:00:00Z').getTime();
  const end = new Date(start.getTime() + (days - 1) * 86400000);
  if (start.getTime() < today || end.getTime() > today + 15 * 86400000) throw new TravelError('Forecast unavailable: the complete trip must fall within the next 16 days. Check weather closer to departure.', 422);
  const url = new URL('https://api.open-meteo.com/v1/forecast');
  Object.entries({latitude: String(lat), longitude: String(lng), daily: 'temperature_2m_max,temperature_2m_min,precipitation_probability_max,weather_code', start_date: startDate, end_date: end.toISOString().slice(0,10), timezone: 'auto'}).forEach(([key, value]) => url.searchParams.set(key, value));
  const payload = await fetchJson<unknown>(url);
  const daily = z.object({daily: z.object({time: z.array(z.string()).length(days), temperature_2m_max: z.array(z.number()).length(days), temperature_2m_min: z.array(z.number()).length(days), precipitation_probability_max: z.array(z.number().min(0).max(100)).length(days), weather_code: z.array(z.number()).length(days)})}).parse(payload).daily;
  return daily.time.map((date, index) => ({day: index + 1, date, condition: condition(daily.weather_code[index]), tempHighC: Math.round(daily.temperature_2m_max[index]), tempLowC: Math.round(daily.temperature_2m_min[index]), precipitationChance: daily.precipitation_probability_max[index]}));
}
