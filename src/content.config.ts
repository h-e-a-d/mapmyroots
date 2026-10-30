import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const glossary = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/glossary' }),
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
