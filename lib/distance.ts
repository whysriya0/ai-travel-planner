import { z } from 'zod';
import { fetchJson, TravelError } from './http';
import { coordinateSchema } from './types';
export type Coordinate = z.infer<typeof coordinateSchema>;
export type DistanceResult = {durationMinutes: number; distanceKm: number; provider: 'osrm'; mode: 'driving'};
export async function getDistanceTime(origin: Coordinate, destination: Coordinate): Promise<DistanceResult> {
  coordinateSchema.parse(origin); coordinateSchema.parse(destination);
  const url = 'https://router.project-osrm.org/route/v1/driving/' + origin.lng + ',' + origin.lat + ';' + destination.lng + ',' + destination.lat + '?overview=false';
  const result = await fetchJson<unknown>(url);
  const parsed = z.object({code: z.literal('Ok'), routes: z.array(z.object({duration: z.number().nonnegative(), distance: z.number().nonnegative()})).min(1)}).safeParse(result);
  if (!parsed.success) throw new TravelError('No driving route was found between these stops.');
  const route = parsed.data.routes[0];
  return {durationMinutes: Math.ceil(route.duration / 60), distanceKm: Math.round(route.distance / 100) / 10, provider: 'osrm', mode: 'driving'};
}
