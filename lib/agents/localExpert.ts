import { searchPlaces, type PlaceSearchResult } from '../places';

export async function localExpert(destination: string, interests = ''): Promise<PlaceSearchResult[]> {
  return searchPlaces(interests.trim() || 'things to do', destination);
}
