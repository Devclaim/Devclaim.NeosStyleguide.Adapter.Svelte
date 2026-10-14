import { parse, type Tags } from 'yaml';

/**
 * The entries of the styleguide: one <Component>.styleguide.yaml next to a component (below the root of the app, e.g.
 * src/lib). The id of an entry is its path below the root with dots ("ui.Button" for src/lib/ui/Button.styleguide.yaml);
 * the preview renders <Component>.styleguide.svelte if there is one (e.g. a list with items), otherwise
 * <Component>.svelte. A page is a document with its content collections, written in the YAML as well: the examples of
 * the styleguide never come from the content of a site.
 */

export type Props = Record<string, unknown>;

export type EditorType = 'text' | 'textarea' | 'number' | 'checkbox' | 'select';

export type Frame = 'padded' | 'page-grid' | 'fullscreen';

export type Entry = {
	id: string;
	title: string;
	level: string;
	description: string;
	/** a content element: the props are the properties of a node of this type */
	node: string | null;
	/** how the preview frames the component: with padding, on the page grid (content elements) or without anything */
	frame: Frame;
	/** maximum width of the frame in px, e.g. for a card */
	width: number | null;
	/** extra data the server passes to the component: "site" (navigation, footer) */
	data: Data | null;
	/** a page: the node type of the document; rendered like a page of the site, with header and footer */
	document: string | null;
	/** the content collections of a page: its content elements, or "all" (every content element of the styleguide) */
	collections: Record<string, PageItem[] | 'all'>;
	/** child nodes of a content element (e.g. the items of an accordion) */
	children: ChildNode[];
	/** a content element that only exists inside another one (an accordion item): shown inside a node of that type */
	parent: ChildNode | null;
	/** only a tethered node of a document (the hero): not one of the content elements of a page */
	tethered: boolean;
	props: Props;
	editors: Record<string, { type: EditorType; options?: unknown[] }>;
	propSets: Record<string, Props>;
	useCases: Record<string, { title: string; props: Props }>;
	/** module paths (import.meta.glob keys) of the component, of what the preview renders and of the YAML file */
	component: string;
	preview: string;
	file: string;
};

type Data = 'site';

type ChildNode = { node: string; props?: Props; children?: ChildNode[] };

/** a content element of a page: an entry of the styleguide with its content (and use case, prop set, props), or a node */
type PageItem = { entry: string; useCase?: string; propSet?: string; props?: Props } | ChildNode;

/** a node as the components get it: built from the YAML, like the nodes of the app's Neos API */
export type ExampleNode = { id: string; nodeType: string; props: Props; children: ExampleNode[] };

export type Level = { label: string; position: number };

/** the settings of the styleguide (the app's styleguide.yaml) */
export type Settings = {
	/** the levels of the navigation; "level" of an entry is one of these keys */
	structure: Record<string, Level>;
	viewportPresets: Record<string, { label: string; width: number; height: number }>;
};

export type CatalogueConfig = {
	/** the settings: the source of the app's styleguide.yaml, or the settings themselves */
	settings: string | Settings;
	/** the YAML files: import.meta.glob('/src/lib/**\/*.styleguide.yaml', { query: '?raw', import: 'default', eager: true }) */
	sources: Record<string, string>;
	/** the module paths of the app's components: Object.keys(import.meta.glob('/src/lib/**\/*.svelte')) */
	components: string[];
	/** the root of the entries, the start of the module paths: "/src/lib/" */
	root: string;
	/** YAML tags of the example data, e.g. "!image 1600x900" (dummyAsset), "!link /de/features" */
	tags?: Tags;
	/** the module path of the component that renders a list of nodes ({ nodes }), e.g. the app's ContentList */
	contentList: string;
	/** the module path of the component that renders a page ({ site, document, collections }) */
	page: string;
	/** the site in a language, for pages and entries with "data: site" (navigation, footer, languages) */
	site: (fetch: typeof globalThis.fetch, lang: string) => Promise<unknown>;
};

export type Catalogue = ReturnType<typeof createCatalogue>;

export function createCatalogue(config: CatalogueConfig) {
	const settings = typeof config.settings === 'string' ? (parse(config.settings) as Settings) : config.settings;
	const components = new Set(config.components);
	const { root } = config;

	const record = <T>(value: unknown, file: string, key: string): Record<string, T> => {
		if (value === undefined || value === null) {
			return {};
		}
		if (typeof value !== 'object' || Array.isArray(value)) {
			throw new Error(`${file}: "${key}" must be a map`);
		}
		return value as Record<string, T>;
	};

	function entryOf(file: string, source: string): Entry {
		const path = file.slice(root.length, -'.styleguide.yaml'.length);
		// the interface keeps the id in one path segment of its URL
		const id = path.replaceAll('/', '.');
		const yaml = (parse(source, { customTags: config.tags }) ?? {}) as Record<string, unknown>;
		const level = String(yaml.level ?? '');
		if (!settings.structure[level]) {
			throw new Error(`${file}: "level" must be one of ${Object.keys(settings.structure).join(', ')}`);
		}
		const document = typeof yaml.document === 'string' ? yaml.document : null;
		const template = `${root}${path}.styleguide.svelte`;
		const component = document ? config.page : components.has(template) ? template : `${root}${path}.svelte`;
		if (!components.has(component)) {
			throw new Error(`${file}: no component ${component}`);
		}
		const collections = record<unknown>(yaml.collections, file, 'collections');
		for (const [name, items] of Object.entries(collections)) {
			if (items !== 'all' && !Array.isArray(items)) {
				throw new Error(`${file}: "collections.${name}" must be a list or "all"`);
			}
		}
		const useCases = record<{ title?: string; props?: Props }>(yaml.useCases, file, 'useCases');

		return {
			id,
			title: String(yaml.title ?? path.slice(path.lastIndexOf('/') + 1)),
			level,
			description: String(yaml.description ?? ''),
			node: typeof yaml.node === 'string' ? yaml.node : null,
			frame: document ? 'fullscreen' : yaml.frame === 'page-grid' || yaml.frame === 'fullscreen' ? yaml.frame : 'padded',
			width: typeof yaml.width === 'number' ? yaml.width : null,
			data: yaml.data === 'site' ? 'site' : null,
			document,
			collections: collections as Record<string, PageItem[] | 'all'>,
			children: Array.isArray(yaml.children) ? (yaml.children as ChildNode[]) : [],
			parent: yaml.parent && typeof yaml.parent === 'object' ? (yaml.parent as ChildNode) : null,
			tethered: yaml.tethered === true,
			props: record(yaml.props, file, 'props'),
			editors: record(yaml.editors, file, 'editors'),
			propSets: record(yaml.propSets, file, 'propSets'),
			useCases: Object.fromEntries(
				Object.entries(useCases).map(([name, useCase]) => [
					name,
					{ title: useCase?.title ?? name, props: record<unknown>(useCase?.props, file, `useCases.${name}.props`) }
				])
			),
			component,
			// inside its parent: rendered like the content of a page
			preview: yaml.parent ? config.contentList : component,
			file
		};
	}

	/** all entries, by level and title; a broken file is left out (and logged), the others stay */
	const entries: Entry[] = Object.entries(config.sources)
		.flatMap(([file, source]) => {
			try {
				return [entryOf(file, source)];
			} catch (error) {
				console.error(`Styleguide: ${file} left out:`, error instanceof Error ? error.message : error);
				return [];
			}
		})
		.sort(
			(a, b) =>
				settings.structure[a.level].position - settings.structure[b.level].position || a.title.localeCompare(b.title)
		);

	const findEntry = (id: string | null) => entries.find((entry) => entry.id === id) ?? null;

	/** the props of a preview: defaults, then the prop set, the use case and the props changed in the inspector */
	function resolveProps(entry: Entry, propSet: string | null, useCase: string | null, overrides: Props): Props {
		const props = {
			...entry.props,
			...(propSet ? entry.propSets[propSet] : undefined),
			...(useCase ? entry.useCases[useCase]?.props : undefined),
			...overrides
		};
		// a select box cannot hold null: "" stands for it
		for (const [name, editor] of Object.entries(entry.editors)) {
			if (editor.type === 'select' && props[name] === '' && editor.options?.includes(null)) {
				props[name] = null;
			}
		}
		return props;
	}

	const childNodes = (children: ChildNode[], prefix: string): ExampleNode[] =>
		children.map((child, index) => ({
			id: `${prefix}-${index}`,
			nodeType: child.node,
			props: child.props ?? {},
			children: childNodes(child.children ?? [], `${prefix}-${index}`)
		}));

	/** the node of a content element, built from its YAML with the props of the preview; id: unique on the page */
	const nodeOf = (entry: Entry & { node: string }, props: Props, id: string): ExampleNode => ({
		id,
		nodeType: entry.node,
		props,
		children: childNodes(entry.children, id)
	});

	/** an element that only exists inside another one (an accordion item) inside a node of that type */
	const inParent = (entry: Entry, node: ExampleNode, id: string): ExampleNode =>
		entry.parent
			? { id: `${id}-parent`, nodeType: entry.parent.node, props: entry.parent.props ?? {}, children: [node] }
			: node;

	/** the content elements: entries of a content element type that stand on their own in a collection */
	const contentElements = () =>
		entries.filter((entry): entry is Entry & { node: string } => !!entry.node && !entry.parent && !entry.tethered);

	/** a value of the YAML that stands for a node: an entry of the styleguide or a node written out */
	const isPageItem = (value: unknown): value is PageItem =>
		!!value && typeof value === 'object' && !Array.isArray(value) && ('entry' in value || 'node' in value);

	/** the nodes of a content collection of a page */
	function collectionNodes(items: PageItem[] | 'all', prefix: string): ExampleNode[] {
		if (items === 'all') {
			return contentElements().map((element, index) =>
				nodeOf(element, resolveProps(element, null, null, {}), `${prefix}-${index}`)
			);
		}
		return items.flatMap((item, index) => {
			const id = `${prefix}-${index}`;
			if ('node' in item) {
				return childNodes([item], prefix).map((node) => ({ ...node, id }));
			}
			const entry = findEntry(item.entry);
			if (!entry?.node) {
				console.error(`Styleguide: ${prefix}: "${item.entry}" is no content element of the styleguide`);
				return [];
			}
			const props = resolveProps(entry, item.propSet ?? null, item.useCase ?? null, item.props ?? {});
			return [inParent(entry, nodeOf(entry as Entry & { node: string }, props, id), id)];
		});
	}

	/**
	 * The props the component gets: a content element its node, a page its document and content collections with the
	 * site around it, entries with "data: site" also the site
	 */
	async function componentProps(
		entry: Entry,
		props: Props,
		{ fetch, lang }: { fetch: typeof globalThis.fetch; lang: string }
	): Promise<Props> {
		if (entry.document) {
			const collections = Object.fromEntries(
				Object.entries(entry.collections).map(([name, items]) => [
					name,
					collectionNodes(items, `styleguide-${entry.id}-${name}`)
				])
			);
			// tethered nodes of the document (the hero) are props, as in the Neos API: written like an item of a collection
			const documentProps = Object.fromEntries(
				Object.entries(props).map(([name, value]) => [
					name,
					isPageItem(value) ? (collectionNodes([value], `styleguide-${entry.id}-${name}`)[0] ?? null) : value
				])
			);
			return {
				document: { nodeType: entry.document, props: documentProps },
				collections,
				site: await config.site(fetch, lang)
			};
		}
		if (entry.node) {
			const id = `styleguide-${entry.id}`;
			const node = nodeOf(entry as Entry & { node: string }, props, id);
			return entry.parent ? { nodes: [inParent(entry, node, id)] } : { node };
		}
		if (entry.data === 'site') {
			return { ...props, site: await config.site(fetch, lang) };
		}
		return props;
	}

	return { settings, entries, findEntry, resolveProps, componentProps };
}
