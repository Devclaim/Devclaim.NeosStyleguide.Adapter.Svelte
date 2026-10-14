# Devclaim.NeosStyleguide.Adapter.Svelte

The SvelteKit adapter of [Devclaim.NeosStyleguide](https://github.com/Devclaim/Devclaim.NeosStyleguide), the
styleguide in the Neos content module: it answers the styleguide protocol for a SvelteKit app. The components describe
themselves in a `<Component>.styleguide.yaml` next to them; the design tokens are the `@theme` blocks of the app's
stylesheets (Tailwind), and a site overrides them in Neos.

- the protocol: manifest, entries, tokens, validation of token overrides
- the preview page and the gallery, in the theme of the selected site
- placeholder images for the example data
- the design tokens: the parser of the `@theme` blocks and the rules for the overrides of a site (also for the pages
    of the site)

How it works: [ARCHITECTURE.md](ARCHITECTURE.md).

## Installation

```bash
yarn add @devclaim/neos-styleguide-adapter-svelte@github:Devclaim/Devclaim.NeosStyleguide.Adapter.Svelte
```

Requires SvelteKit 3 and Svelte 5, and the core package in Neos (`composer require devclaim/neos-styleguide`). The
package ships its TypeScript and Svelte sources; Vite compiles them with the app.

## Setup

1. **The tokens** (server only, the stylesheets are read as text):

    ```ts
    // src/lib/design/tokens.server.ts
    import { themeTokens } from '@devclaim/neos-styleguide-adapter-svelte';
    import styles from './styles/Styles.css?raw';

    export const theme = themeTokens([styles]);
    ```

    The pages of the site write `theme.overrides(site.designTokens).css` into a `<style>:root{…}</style>` in the
    `<head>`, after the stylesheet.

2. **The styleguide:**

    ```ts
    // src/lib/styleguide/styleguide.server.ts
    import { NEOS_API_URL } from '$app/env/private';
    import { createStyleguide } from '@devclaim/neos-styleguide-adapter-svelte/server';
    import { theme } from '#lib/design/tokens.server.ts';
    import settings from './styleguide.yaml?raw';

    export const styleguide = createStyleguide({
        neosApiUrl: NEOS_API_URL,
        settings, // levels and viewports
        root: '/src/lib/',
        sources: import.meta.glob<string>('/src/lib/**/*.styleguide.yaml', { query: '?raw', import: 'default', eager: true }),
        components: Object.keys(import.meta.glob('/src/lib/**/*.svelte')),
        contentList: '/src/lib/content/ContentList.svelte', // renders { nodes }
        page: '/src/lib/styleguide/Page.svelte', // renders { site, document, collections }
        site: (fetch, lang) => loadSite(fetch, lang), // header, footer, navigation
        tokens: theme
        // optional: basePath ('/neos/styleguide'), name, sourcePrefix, tags (YAML tags of the example data)
    });
    ```

3. **The routes** below `basePath`:

    ```ts
    // src/routes/neos/styleguide/[...path]/+server.ts
    export const GET = (event) => styleguide.endpoint(event);
    export const POST = (event) => styleguide.endpoint(event);

    // src/routes/neos/styleguide/preview/+page.server.ts
    export const load = (event) => styleguide.preview(event);

    // src/routes/neos/styleguide/preview/+page.ts
    const modules = import.meta.glob('/src/lib/**/*.svelte');
    export const load = async ({ data }) => ({ ...data, items: await withComponents(modules, data.items) });
    ```

    ```svelte
    <!-- src/routes/neos/styleguide/preview/+page.svelte: the site's tokens in the head, the entries, the page grid -->
    <svelte:head>{@html `<style>:root{${data.tokenCss}}</style>`}</svelte:head>
    <Previews items={data.items} frames={{ padded: 'p-24', 'page-grid': 'my-page-grid py-24' }} />
    ```

4. **The login:** the adapter asks Neos with the editor's session. `handleFetch` passes the `cookie` of the request
    on to `neosApiUrl` for requests below `basePath`; the answers must not be cached by shared caches.

The app has to be on the host of the Neos backend (the styleguide reads the previews in its iframes).

## License

GPL-3.0-or-later
