import { z } from 'zod';
import { supervisor } from '@/lib/agents/supervisor';

const requestSchema = z.object({destination: z.string().trim().min(2).max(120), days: z.coerce.number().int().min(1).max(14), interests: z.string().trim().max(600).optional(), startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()});

export async function POST(request: Request) {
  try {
    const input = requestSchema.parse(await request.json());
    return Response.json(await supervisor(input), {headers: {'Cache-Control': 'no-store'}});
  } catch (error) {
    return Response.json({error: error instanceof Error ? error.message : 'Unable to plan this trip.'}, {status: 400});
  }
}
