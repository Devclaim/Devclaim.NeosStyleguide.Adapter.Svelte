/**
 * The styleguide protocol, version 2 (Devclaim.NeosStyleguide, PROTOCOL.md): what the interface of the styleguide asks
 * the frontend (the adapter). The previews are plain pages: the interface works on them itself.
 */

export const PROTOCOL = 2;

export type Level = { id: string; label: string; position: number };

export type Viewport = { id: string; label: string; width: number; height: number };

export type Manifest = {
	protocol: typeof PROTOCOL;
	name: string;
	levels: Level[];
	viewports: Viewport[];
	/** URL template with {entry} and {site} */
	preview: string;
	/** URL template with {entries} (ids, separated by commas) and {site}: every entry with its defaults on one page */
	gallery?: string;
	/** the preview draws the page grid while <html> has the attribute data-styleguide-grid */
	features: { grid: boolean };
};

export type Variant = { id: string; title: string };

export type EntrySummary = {
	id: string;
	title: string;
	level: string;
	description: string;
	useCases: Variant[];
	propSets: Variant[];
	source: string;
	/** false: not for the gallery (a whole page); missing: true */
	gallery?: boolean;
	/** a whole page: shown at the height of a screen and scrolled inside, like in a browser; missing: false */
	page?: boolean;
};

export type Editor =
	| { type: 'text' | 'textarea' | 'number' | 'checkbox' }
	| { type: 'select'; options: { value: string; label: string }[] };

export type EntryDetails = Omit<EntrySummary, 'useCases' | 'propSets'> & {
	props: { name: string; value: unknown; editor: Editor }[];
	propSets: (Variant & { props: Record<string, unknown> })[];
	useCases: (Variant & { props: Record<string, unknown> })[];
};

export type TokenType = 'color' | 'font' | 'size' | 'shadow' | 'ratio' | 'breakpoint' | 'other';

/** design: the raw values of the design (palette, scales); semantic: what components use, pointing at design tokens */
export type TokenLayer = 'design' | 'semantic';

/** a value of a semantic token per variant: "light", "dark" (the color scheme), "base", "md", "lg", "xl" (from a width) */
export type TokenVariant = { id: string; token: string };

export type Token = {
	name: string;
	value: string;
	group: string;
	type: TokenType;
	description: string;
	editable: boolean;
	/** missing: unknown (an adapter without layers) */
	layer?: TokenLayer;
	/** a semantic token with a value per variant: change those, not the token itself */
	variants?: TokenVariant[];
	/** a variant: the semantic token it is a value of, and which variant */
	variantOf?: string;
	variant?: string;
	/** a semantic token: the groups whose design tokens it may point at (var(--…)) */
	pointsAt?: string[];
};

/** kind: the id of a kind (Tokens.kinds), the navigation of the tokens */
export type TokenGroup = { id: string; label: string; description?: string; kind?: string };

/** a kind of tokens (colors, typography …): several groups; without kinds every group stands alone */
export type TokenKind = { id: string; label: string };

export type Tokens = { protocol: typeof PROTOCOL; kinds?: TokenKind[]; groups: TokenGroup[]; tokens: Token[] };

export type Validation = {
	protocol: typeof PROTOCOL;
	valid: Record<string, string>;
	invalid: { name: string; value: string; reason: string }[];
};
