import { defineCollection, z } from 'astro:content';

const glossary = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    description: z.string(),
    relatedTerms: z.array(z.string()).default([]),
    publishedAt: z.coerce.date().optional()
  })
});

export const collections = { glossary };
