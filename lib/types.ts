import { z } from 'zod';

export const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => {
  const date = new Date(value + 'T00:00:00Z');
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}, 'Use a valid calendar date.');
export const coordinateSchema = z.object({lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180)});
export const weatherRequestSchema = coordinateSchema.extend({startDate: dateSchema, days: z.number().int().min(1).max(14)});
export const placesRequestSchema = z.object({query: z.string().trim().min(2).max(120), location: z.string().trim().min(2).max(120)});
export const itineraryStopSchema = coordinateSchema.extend({
  id: z.string().min(1), day: z.number().int().min(1).max(14), name: z.string().min(1).max(200),
  placeId: z.string().min(1), category: z.string().min(1).max(80), estimatedCost: z.number().nonnegative().max(1000000),
  reason: z.string().min(1).max(1200), rating: z.number().min(0).max(5).optional(), photoUrl: z.string().url().optional()
});
export const dayWeatherSchema = z.object({day: z.number().int().min(1), date: dateSchema, condition: z.string(), tempHighC: z.number(), tempLowC: z.number(), precipitationChance: z.number().min(0).max(100)});
export const itinerarySchema = z.object({destination: z.string(), days: z.number().int().min(1).max(14), stops: z.array(itineraryStopSchema).min(1).max(70), weather: z.array(dayWeatherSchema), totalEstimatedCost: z.number().nonnegative(), legs: z.array(z.object({fromId:z.string(),toId:z.string(),durationMinutes:z.number().nonnegative(),distanceKm:z.number().nonnegative(),mode:z.literal('driving'),provider:z.literal('osrm')})).optional()});
export const itineraryRequestSchema = z.object({
  destination: z.string().trim().min(2).max(120), startDate: dateSchema.refine(value => value >= new Date().toISOString().slice(0,10), 'Choose today or a future date.'),
  days: z.number().int().min(1).max(14).default(3), budget: z.number().positive().max(10000000).default(1500),
  travelers: z.number().int().min(1).max(30).default(2), interests: z.string().trim().max(600).default('')
});
export type ItineraryStop = z.infer<typeof itineraryStopSchema>;
export type DayWeather = z.infer<typeof dayWeatherSchema>;
export type Itinerary = z.infer<typeof itinerarySchema>;
export type ItineraryRequest = z.infer<typeof itineraryRequestSchema>;
export type AgentTraceEvent = {
  agent: 'Supervisor' | 'Local Expert' | 'Tool';
  action: string;
  detail: string;
  timestamp: number;
  status?: 'running' | 'complete' | 'error';
};
