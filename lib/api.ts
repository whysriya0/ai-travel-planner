import { z } from 'zod';
import { itineraryRequestSchema, placesRequestSchema, weatherRequestSchema, coordinateSchema } from './types';
import { backendName, generateItinerary, modelName } from './ollama';
import { searchPlaces } from './places';
import { getWeather } from './weather';
import { getDistanceTime } from './distance';
import { fetchJson, TravelError } from './http';
import { supervisor } from './agents/supervisor';

let planning = false;
const phaseOnePlanSchema = z.object({destination: z.string().trim().min(2).max(120), days: z.coerce.number().int().min(1).max(14), interests: z.string().trim().max(600).optional(), startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()});
export async function handleApi(request: Request): Promise<Response> {
  const path = new URL(request.url).pathname;
  const json = (data: unknown, status = 200) => Response.json(data, {status, headers: {'Cache-Control': 'no-store'}});
  try {
    if (path === '/api/health' && request.method === 'GET') {
      let modelInstalled = false;
      let providerReachable = false;
      try {
        if (backendName() === 'omniroute') {
          const base = (process.env.OMNIROUTE_URL || 'http://127.0.0.1:20128').replace(/\/$/, '');
          const models = await fetchJson<{data?: Array<{id: string}>}>(`${base}/v1/models`, {headers: {Authorization: `Bearer ${process.env.OMNIROUTE_API_KEY || 'sk_omniroute'}`}}, 3000);
          providerReachable = true;
          modelInstalled = Boolean(models.data?.some(model => model.id === modelName()));
        } else {
          const tags = await fetchJson<{models?: Array<{name: string}>}>((process.env.OLLAMA_URL || 'http://127.0.0.1:11434') + '/api/tags', {}, 3000);
          providerReachable = true;
          modelInstalled = Boolean(tags.models?.some(model => model.name === modelName()));
        }
      } catch { /* Report readiness without leaking configuration. */ }
      const placesConfigured = Boolean(process.env.GOOGLE_MAPS_API_KEY);
      return json({ready: modelInstalled && placesConfigured, backend: backendName(), providerReachable, model: modelName(), modelInstalled, placesConfigured, weather: 'Open-Meteo', routing: 'OSRM driving'});
    }
    if (!['/api/itinerary', '/api/plan', '/api/places', '/api/weather', '/api/distance'].includes(path)) return json({error: 'API route not found.'}, 404);
    if (request.method !== 'POST') return json({error: 'Use POST for this endpoint.'}, 405);
    let body: unknown;
    try { body = await request.json(); } catch { return json({error: 'Send a valid JSON request.'}, 400); }
    if (path === '/api/itinerary') {
      const input = itineraryRequestSchema.parse(body);
      if (planning) return json({error: 'Roam is already planning a trip. Please wait for it to finish.'}, 429);
      planning = true;
      try { return json(await generateItinerary(input)); } finally { planning = false; }
    }
    if (path === '/api/plan') {
      const input = phaseOnePlanSchema.parse(body);
      if (planning) return json({error: 'Roam is already planning a trip. Please wait for it to finish.'}, 429);
      planning = true;
      try { return json(await supervisor(input)); } finally { planning = false; }
    }
    if (path === '/api/places') {
      const input = placesRequestSchema.parse(body);
      return json({places: await searchPlaces(input.query, input.location)});
    }
    if (path === '/api/weather') {
      const input = weatherRequestSchema.parse(body);
      return json({weather: await getWeather(input.lat, input.lng, input.startDate, input.days)});
    }
    const input = z.object({origin: coordinateSchema, destination: coordinateSchema}).parse(body);
    return json(await getDistanceTime(input.origin, input.destination));
  } catch (error) {
    if (error instanceof z.ZodError) return json({error: 'Please check the request fields.', issues: error.flatten()}, 400);
    return json({error: error instanceof TravelError ? error.message : 'Unable to complete the request. Please try again.'}, error instanceof TravelError ? error.status : 502);
  }
}

