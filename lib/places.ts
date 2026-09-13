import { z } from 'zod';
import { fetchJson, TravelError } from './http';
import { placesRequestSchema } from './types';

const placeSchema = z.object({
  id: z.string().min(1), displayName: z.object({text: z.string().min(1)}),
  location: z.object({latitude: z.number().min(-90).max(90), longitude: z.number().min(-180).max(180)}),
  rating: z.number().min(0).max(5).optional()
});
export type PlaceSearchResult = {name: string; placeId: string; lat: number; lng: number; rating?: number};

export async function searchPlaces(query: string, location: string): Promise<PlaceSearchResult[]> {
  placesRequestSchema.parse({query, location});
  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (!key) throw new TravelError('Add GOOGLE_MAPS_API_KEY to .env.local and enable Places API (New) to search real activities.', 503);
  const payload = await fetchJson<unknown>('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: {'Content-Type': 'application/json', 'X-Goog-Api-Key': key, 'X-Goog-FieldMask': 'places.id,places.displayName,places.location,places.rating'},
    body: JSON.stringify({textQuery: query + ', ' + location, pageSize: 10})
  });
  const parsed = z.object({places: z.array(placeSchema).default([])}).parse(payload);
  return parsed.places.map(place => ({name: place.displayName.text, placeId: place.id, lat: place.location.latitude, lng: place.location.longitude, rating: place.rating}));
}
