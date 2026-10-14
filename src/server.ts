import { error, json, type RequestEvent } from '@sveltejs/kit';
import { createAdapter } from './adapter.ts';
import { type CatalogueConfig, createCatalogue, type Entry, type Frame, type Props } from './catalogue.ts';
import { dummyImageResponse } from './dummyImage.ts';
import { PROTOCOL } from './protocol.ts';
import { getSites, pickSite } from './sites.ts';
import type { ThemeTokens } from './tokens.ts';

export type { CatalogueConfig, Entry, ExampleNode, Settings } from './catalogue.ts';
export { getSites, pickSite, type StyleguideSite } from './sites.ts';

export type StyleguideConfig = CatalogueConfig & {
	/** where the Neos API is, for the server (the sites and the login: Devclaim.NeosStyleguide /api/styleguide/v1/sites) */
	neosApiUrl: string;
	/** the design tokens of the app (themeTokens) */
	tokens: ThemeTokens;
	/** where the app serves the styleguide; default "/neos/styleguide" (the default of the core's adapter setting) */
	basePath?: string;
	/** the name of the adapter in the interface; default "SvelteKit" */
	name?: string;
	/** put before the module path of an entry's YAML file, its source in the interface, e.g. "Frontend" */
	sourcePrefix?: string;
};

export type PreviewItem = { entry: string; component: string; frame: Frame; width: number | null; props: Props };

export type PreviewData = { title: string; items: PreviewItem[]; tokenCss: string; lang: string };

/** at most this many entries in one gallery */
const MAX_ENTRIES = 100;

const noStore = { 'cache-control': 'no-store' };

/**
 * The styleguide in a SvelteKit app. The app routes two things to it:
 * - <basePath>/[...path]/+server.ts: GET and POST = endpoint (the protocol under api/v1, placeholder images under image)
 * - <basePath>/preview/+page.server.ts: load = preview (+page.ts: withComponents, +page.svelte: Previews.svelte)
 * and its handleFetch passes the editor's cookie on to neosApiUrl for requests below basePath.
 */
export function createStyleguide(config: StyleguideConfig) {
	const basePath = config.basePath ?? '/neos/styleguide';
	const catalogue = createCatalogue(config);
	const adapter = createAdapter(catalogue, {
		name: config.name ?? 'SvelteKit',
		basePath,
		sourcePrefix: config.sourcePrefix ?? '',
		tokens: config.tokens
	});

	/** the sites the logged-in editor may see; throws 401 without a backend session */
	const sites = (fetch: typeof globalThis.fetch) =>
		getSites(fetch, config.neosApiUrl, (designTokens) => config.tokens.overrides(designTokens).css);

	/** the protocol (PROTOCOL.md) and the placeholder images, below basePath */
	async function endpoint({ fetch, request, url }: RequestEvent): Promise<Response> {
		const path = url.pathname.slice(basePath.length).replace(/^\/+|\/+$/g, '');
		const method = request.method;
		if (path === 'image' && method === 'GET') {
			// GET image?asset=styleguide-dummy-1600x900&width=640&ratio=4:3: a placeholder variant
			return dummyImageResponse(url.searchParams) ?? error(404, 'Not a placeholder');
		}
		if (!path.startsWith('api/v1/')) {
			error(404, 'Not found');
		}
		const route = path.slice('api/v1/'.length);
		// everything else needs a backend login
		await sites(fetch);
		if (method === 'GET' && route === 'manifest') {
			return json(adapter.manifest(), { headers: noStore });
		}
		if (method === 'GET' && route === 'entries') {
			return json({ protocol: PROTOCOL, entries: adapter.listEntries() }, { headers: noStore });
		}
		if (method === 'GET' && route.startsWith('entries/')) {
			const entry = catalogue.findEntry(decodeURIComponent(route.slice('entries/'.length)));
			if (!entry) {
				error(404, 'No such entry');
			}
			return json({ protocol: PROTOCOL, entry: adapter.details(entry) }, { headers: noStore });
		}
		if (method === 'GET' && route === 'tokens') {
			return json(adapter.tokens(), { headers: noStore });
		}
		if (method === 'POST' && route === 'tokens/validate') {
			// {"overrides": {"--name": "value"}}: which overrides are allowed
			const body = (await request.json().catch(() => null)) as { overrides?: unknown } | null;
			const overrides = body?.overrides;
			if (!overrides || typeof overrides !== 'object' || Array.isArray(overrides)) {
				error(400, 'overrides must be an object');
			}
			return json(adapter.validate(overrides as Record<string, unknown>));
		}
		error(404, 'Not found');
	}

	/**
	 * The preview (PROTOCOL.md "Preview"), in the theme of the selected site:
	 * - one entry: ?entry=…&site=…&useCase=…&propSet=…&props={…} (props: the values changed in the inspector, applied last)
	 * - the gallery: ?entries=<id>,<id>,…&site=…, every entry with its defaults
	 */
	async function preview({ fetch, url }: RequestEvent): Promise<PreviewData> {
		const query = url.searchParams;
		const gallery = query.has('entries');
		const entries = (gallery ? (query.get('entries') ?? '').split(',') : [query.get('entry')])
			.slice(0, MAX_ENTRIES)
			.map(catalogue.findEntry)
			.filter((entry): entry is Entry => entry !== null);
		if (entries.length === 0) {
			error(404, 'No such entry');
		}
		const site = pickSite(await sites(fetch), query.get('site'));
		// the default language of the site: the styleguide shows placeholder content
		const lang = site?.languages[0]?.code ?? 'en';

		let overrides: unknown = {};
		try {
			overrides = JSON.parse(query.get('props') || '{}');
		} catch {
			// keep the defaults
		}
		const changed = overrides && typeof overrides === 'object' && !Array.isArray(overrides) ? (overrides as Props) : {};

		const items = await Promise.all(
			entries.map(async (entry) => {
				const props = gallery
					? catalogue.resolveProps(entry, null, null, {})
					: catalogue.resolveProps(entry, query.get('propSet'), query.get('useCase'), changed);
				return {
					entry: entry.id,
					component: entry.preview,
					frame: entry.frame,
					width: entry.width,
					props: await catalogue.componentProps(entry, props, { fetch, lang })
				};
			})
		);

		return { title: gallery ? 'Styleguide' : entries[0].title, items, tokenCss: site?.tokenCss ?? '', lang };
	}

	return { basePath, catalogue, adapter, sites, endpoint, preview };
}
