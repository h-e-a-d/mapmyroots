import { defineCollection, z } from 'astro:content';

const glossary = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    description: z.string(),
    letter: z.string().length(1),
    aka: z.array(z.string()).default([]),
    relatedTerms: z.array(z.string()).default([]),
    publishedAt: z.coerce.date().optional()
  })
});

export const collections = { glossary };
