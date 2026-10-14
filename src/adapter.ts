import type { Catalogue, EditorType, Entry } from './catalogue.ts';
import {
	type Editor,
	type EntryDetails,
	type EntrySummary,
	type Manifest,
	PROTOCOL,
	type TokenGroup,
	type TokenKind,
	type Tokens,
	type TokenType,
	type Validation
} from './protocol.ts';
import type { ThemeTokens } from './tokens.ts';

/**
 * The answers of the styleguide protocol (protocol.ts): the catalogue (catalogue.ts) and the design tokens (tokens.ts)
 * in its format. The routes: server.ts.
 */

export type AdapterConfig = {
	/** the name of the adapter in the interface */
	name: string;
	/** where the app serves the styleguide: "/neos/styleguide" */
	basePath: string;
	/** put before the module path of an entry's YAML file, its source in the interface: "Frontend" */
	sourcePrefix: string;
	tokens: ThemeTokens;
};

export function createAdapter(catalogue: Catalogue, config: AdapterConfig) {
	const { settings, entries } = catalogue;

	const manifest = (): Manifest => ({
		protocol: PROTOCOL,
		name: config.name,
		levels: Object.entries(settings.structure)
			.map(([id, level]) => ({ id, label: level.label, position: level.position }))
			.sort((a, b) => a.position - b.position),
		viewports: Object.entries(settings.viewportPresets).map(([id, viewport]) => ({ id, ...viewport })),
		preview: `${config.basePath}/preview?entry={entry}&site={site}`,
		gallery: `${config.basePath}/preview?entries={entries}&site={site}`,
		features: { grid: true }
	});

	const summary = (entry: Entry): EntrySummary => ({
		id: entry.id,
		title: entry.title,
		level: entry.level,
		description: entry.description,
		useCases: Object.entries(entry.useCases).map(([id, useCase]) => ({ id, title: useCase.title })),
		propSets: Object.keys(entry.propSets).map((id) => ({ id, title: id })),
		source: `${config.sourcePrefix}${entry.file}`,
		// whole pages and full screen entries only alone
		gallery: !entry.document && entry.frame !== 'fullscreen',
		// a page (a document with its content): scrolled inside its frame
		page: entry.document !== null
	});

	/** the entry with its inspector; defaults: the props with their values (e.g. the properties of its example node) */
	const details = (entry: Entry, defaults: Record<string, unknown> = entry.props): EntryDetails => ({
		...summary(entry),
		props: Object.entries(defaults).flatMap(([name, value]) => {
			const editor = editorOf(entry, name, value);
			return editor ? [{ name, value: value === null ? '' : value, editor }] : [];
		}),
		propSets: Object.entries(entry.propSets).map(([id, props]) => ({ id, title: id, props })),
		useCases: Object.entries(entry.useCases).map(([id, useCase]) => ({ id, title: useCase.title, props: useCase.props }))
	});

	const listEntries = () => entries.map(summary);

	function tokens(): Tokens {
		const defaults = config.tokens.defaults;
		const groups = new Map<string, TokenGroup>();
		const list = defaults.map((token) => {
			const group = slug(token.group);
			const names = defaults.filter((other) => other.group === token.group).map((other) => other.name);
			groups.set(group, {
				id: group,
				label: token.group || 'Other',
				description: token.groupDescription,
				kind: kindOf(names)
			});
			return {
				name: token.name,
				value: token.value,
				group,
				type: tokenType(token.name),
				description: token.description,
				editable: config.tokens.editable(token.name)
			};
		});
		const used = new Set([...groups.values()].map((group) => group.kind));
		return { protocol: PROTOCOL, kinds: KINDS.filter((kind) => used.has(kind.id)), groups: [...groups.values()], tokens: list };
	}

	/** the overrides a site may use, with the rules applied when they are rendered (ThemeTokens.overrides) */
	function validate(overrides: Record<string, unknown>): Validation {
		const result: Validation = { protocol: PROTOCOL, valid: {}, invalid: [] };
		for (const [name, raw] of Object.entries(overrides)) {
			const value = typeof raw === 'string' ? raw.trim() : '';
			const reason = typeof raw === 'string' ? config.tokens.rejection(name, value) : 'value not allowed';
			if (reason) {
				result.invalid.push({ name, value: String(raw), reason });
			} else {
				result.valid[name] = value;
			}
		}
		return result;
	}

	return { manifest, listEntries, details, tokens, validate };
}

/** the editor for a default value without configured editor; null for lists, objects and null */
function inferredEditor(value: unknown): EditorType | null {
	if (typeof value === 'boolean') {
		return 'checkbox';
	}
	if (typeof value === 'number') {
		return 'number';
	}
	if (typeof value === 'string') {
		// markup and long texts
		return value.includes('<') || value.includes('\n') || value.length > 60 ? 'textarea' : 'text';
	}
	return null;
}

/** the editor of a prop: configured in the YAML file, or from the type of its default */
function editorOf(entry: Entry, name: string, value: unknown): Editor | null {
	const configured = entry.editors[name];
	const type = configured?.type ?? inferredEditor(value);
	if (type === 'select') {
		const options = (configured?.options ?? []).map((option) => ({
			value: option === null ? '' : String(option),
			label: option === null ? '–' : String(option)
		}));
		return { type, options };
	}
	return type ? { type } : null;
}

/** the kind of a token by its name, for the editor of the interface */
function tokenType(name: string): TokenType {
	const types: [RegExp, TokenType][] = [
		[/^--color-/, 'color'],
		[/^--font-/, 'font'],
		[/^--(text-size|leading|paragraph-spacing|spacing|max-width)-/, 'size'],
		[/^--shadow-/, 'shadow'],
		[/^--aspect-/, 'ratio'],
		[/^--breakpoint-/, 'breakpoint']
	];
	return types.find(([pattern]) => pattern.test(name))?.[1] ?? 'other';
}

const slug = (label: string) =>
	label
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-|-$/g, '') || 'other';

/** the kinds of tokens, the navigation of the styleguide, in this order */
const KINDS: TokenKind[] = [
	{ id: 'colors', label: 'Farben' },
	{ id: 'typography', label: 'Schrift' },
	{ id: 'spacing', label: 'Abstände und Größen' },
	{ id: 'shadows', label: 'Schatten' },
	{ id: 'ratios', label: 'Formate' },
	{ id: 'grid', label: 'Raster' }
];

/** the kind of a group, by the names of its tokens */
function kindOf(names: string[]): string {
	const any = (pattern: RegExp) => names.some((name) => pattern.test(name));
	if (names.every((name) => name.startsWith('--color-'))) {
		return 'colors';
	}
	if (any(/^--(font|text-size|leading|paragraph-spacing)-/)) {
		return 'typography';
	}
	if (any(/^--shadow-/)) {
		return 'shadows';
	}
	if (any(/^--aspect-/)) {
		return 'ratios';
	}
	if (any(/^--(breakpoint|container|grid|max-width-page)-/)) {
		return 'grid';
	}
	return 'spacing';
}
