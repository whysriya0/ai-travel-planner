import { z } from 'zod';
import { itineraryRequestSchema, placesRequestSchema, weatherRequestSchema, coordinateSchema } from './types';
import { backendName, generateItinerary, modelName } from './ollama';
import { searchPlaces } from './places';
import { getWeather } from './weather';
import { getDistanceTime } from './distance';
import { fetchJson, TravelError } from './http';
import { supervisor } from './agents/supervisor';
import { searchRedditTravel } from './reddit';
import { searchFlights, searchHotels } from './searchapi';
import { createPlaidLinkToken, estimateFromPlaid } from './finance';

let planning = false;
const phaseOnePlanSchema = z.object({destination: z.string().trim().min(2).max(120), days: z.coerce.number().int().min(1).max(14), interests: z.string().trim().max(600).optional(), startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()});
const travelSearchSchema = z.object({origin:z.string().trim().min(2).max(120),destination:z.string().trim().min(2).max(120),startDate:z.string().regex(/^\d{4}-\d{2}-\d{2}$/),days:z.number().int().min(1).max(30),travelers:z.number().int().min(1).max(9),budget:z.number().positive().max(10000000),currency:z.string().regex(/^[A-Z]{3}$/).default('USD')});
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
      return json({ready: modelInstalled && placesConfigured, backend: backendName(), providerReachable, model: modelName(), modelInstalled, placesConfigured, redditConfigured:Boolean(process.env.REDDIT_CLIENT_ID&&process.env.REDDIT_CLIENT_SECRET),searchConfigured:Boolean(process.env.SEARCHAPI_API_KEY),financeConfigured:Boolean(process.env.PLAID_CLIENT_ID&&process.env.PLAID_SECRET),weather: 'Open-Meteo', routing: 'OSRM driving'});
    }
    if (!['/api/itinerary', '/api/plan', '/api/places', '/api/weather', '/api/distance', '/api/reddit', '/api/travel-search', '/api/finance/link-token', '/api/finance/estimate'].includes(path)) return json({error: 'API route not found.'}, 404);
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
    if (path === '/api/reddit') {
      const input=z.object({destination:z.string().trim().min(2).max(120),interests:z.string().trim().max(600).default('')}).parse(body);
      return json({suggestions:await searchRedditTravel(input.destination,input.interests)});
    }
    if (path === '/api/travel-search') {
      const input=travelSearchSchema.parse(body);
      const [flights,hotels]=await Promise.all([searchFlights(input),searchHotels(input)]);
      return json({flights,hotels,source:'SearchApi'});
    }
    if (path === '/api/finance/link-token') {
      const input=z.object({clientUserId:z.string().min(8).max(100)}).parse(body);
      return json(await createPlaidLinkToken(input.clientUserId));
    }
    if (path === '/api/finance/estimate') {
      const input=z.object({publicToken:z.string().min(8),days:z.number().int().min(1).max(30),budget:z.number().positive().max(10000000)}).parse(body);
      return json({estimate:await estimateFromPlaid(input.publicToken,input.days,input.budget)});
    }
    const input = z.object({origin: coordinateSchema, destination: coordinateSchema}).parse(body);
    return json(await getDistanceTime(input.origin, input.destination));
  } catch (error) {
    if (error instanceof z.ZodError) return json({error: 'Please check the request fields.', issues: error.flatten()}, 400);
    return json({error: error instanceof TravelError ? error.message : 'Unable to complete the request. Please try again.'}, error instanceof TravelError ? error.status : 502);
  }
}

