import {z} from 'zod';

export const itineraryStopSchema=z.object({
 id:z.string(),day:z.number().int().min(1),name:z.string(),placeId:z.string(),lat:z.number(),lng:z.number(),category:z.string(),estimatedCost:z.number().nonnegative(),reason:z.string(),rating:z.number().min(0).max(5).optional(),photoUrl:z.string().url().optional()
});
export const dayWeatherSchema=z.object({day:z.number().int().min(1),date:z.string(),condition:z.string(),tempHighC:z.number(),tempLowC:z.number(),precipitationChance:z.number().min(0).max(100)});
export const itinerarySchema=z.object({destination:z.string(),days:z.number().int().min(1),stops:z.array(itineraryStopSchema),weather:z.array(dayWeatherSchema),totalEstimatedCost:z.number().nonnegative()});
export const itineraryRequestSchema=z.object({destination:z.string().trim().min(2).max(120),startDate:z.string().regex(/^\d{4}-\d{2}-\d{2}$/),days:z.coerce.number().int().min(1).max(14).default(3),budget:z.coerce.number().nonnegative().max(10000000).default(1500),travelers:z.coerce.number().int().min(1).max(30).default(2),interests:z.string().trim().max(600).default('')});
export type ItineraryStop=z.infer<typeof itineraryStopSchema>;
export type DayWeather=z.infer<typeof dayWeatherSchema>;
export type Itinerary=z.infer<typeof itinerarySchema>;
export type ItineraryRequest=z.infer<typeof itineraryRequestSchema>;

