import { generateItinerary, type AgentResult } from '../ollama';
import type { ItineraryRequest } from '../types';

export type PhaseOnePlanRequest = {destination: string; days: number; interests?: string; startDate?: string};

export async function supervisor(request: PhaseOnePlanRequest): Promise<AgentResult> {
  const startDate = request.startDate || new Date().toISOString().slice(0, 10);
  const input: ItineraryRequest = {destination: request.destination, startDate, days: request.days, interests: request.interests || '', budget: 10000000, travelers: 1};
  return generateItinerary(input);
}
