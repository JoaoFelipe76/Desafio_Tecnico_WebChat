import { z } from 'zod';

export const allowedSteps = ['greeting', 'needs', 'offer', 'closing', 'fallback'];
export const allowedTopics = ['speed', 'usage', 'budget', 'provider', 'wifi', 'installation', 'promotion'];

export const AgentOutputSchema = z.object({
  response: z.string().min(1),
  step: z.enum(allowedSteps),
  topics: z.array(z.enum(allowedTopics)).default([]),
});


