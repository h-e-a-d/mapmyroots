import { OGImageRoute } from 'astro-og-canvas';

const pages = {
  'home.png': {
    title: 'MapMyRoots',
    description: 'Free Family Tree Builder & Genealogy Software'
  },
  'about.png': {
    title: 'About MapMyRoots',
    description: 'Our mission: free, privacy-focused family tree software'
  },
  'contact.png': {
    title: 'Contact MapMyRoots',
    description: 'Get in touch with our team'
  },
  'builder.png': {
    title: 'Family Tree Builder',
    description: 'Create interactive family trees — free, no registration'
  },
  'privacy.png': {
    title: 'Privacy Policy',
    description: 'Your data stays on your device'
  },
  'terms.png': {
    title: 'Terms of Service',
    description: 'Free, fair, simple terms'
  },
  'glossary.png': {
    title: 'Genealogy Glossary',
    description: 'Essential terms for family history research'
  }
};

export const { getStaticPaths, GET } = await OGImageRoute({
  param: 'slug',
  pages,
  getImageOptions: (_path: string, page: { title: string; description: string }) => ({
    title: page.title,
    description: page.description,
    bgGradient: [[15, 134, 108], [26, 77, 62]],
    border: { color: [255, 255, 255], width: 2 },
    padding: 60,
    font: {
      title: {
        families: ['Playfair Display'],
        weight: 'Bold',
        color: [255, 255, 255]
      },
      description: {
        families: ['Inter'],
        weight: 'Normal',
        color: [220, 230, 220]
      }
    }
  })
});
