import { defineConfig } from 'astro/config';
import node from '@astrojs/node';

/* Invitations are addressed /<weddingSlug>/<inviteeSlug> and both come from
   portal-api at request time, so a wedding created in the portal is live
   immediately — no rebuild. Hence server output plus the node adapter. */
export default defineConfig({
  site: 'https://example.com',
  output: 'server',
  adapter: node({ mode: 'standalone' }),
  image: { domains: ['images.unsplash.com'] },
});
