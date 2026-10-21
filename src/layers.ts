import type { TokenLayer, TokenVariant } from './protocol.ts';
import type { DesignToken } from './tokens.ts';

/**
 * The layers of the tokens (PROTOCOL.md, "Layers and variants"), read from the conventions of the stylesheets, so there
 * is no second list to keep in sync:
 * - a group whose label starts with "Semantic" holds semantic tokens (what components use), every other group design
 *   tokens (the raw values of the design)
 * - a semantic token named like another one plus "-light", "-dark" (the color scheme) or "-base", "-md", "-lg", "-xl"
 *   (from that width) is a variant of it
 * - a semantic token points at the design tokens of its namespace ("--color-…" at the color groups, "--spacing-…" at
 *   the spacing groups …)
 */

export type TokenLayers = {
	layer: TokenLayer;
	/** on a semantic token with variants: its variants, in the order of VARIANTS */
	variants?: TokenVariant[];
	/** on a variant: the semantic token it is a value of, and its variant */
	variantOf?: string;
	variant?: string;
	/** on a semantic token: the ids of the groups whose tokens it may point at */
	pointsAt?: string[];
};

/** the variants, in their order: the color scheme, then the widths */
export const VARIANTS = ['light', 'dark', 'base', 'md', 'lg', 'xl'] as const;

/** the namespaces of the tokens (Tailwind's), longest first: a token points at tokens of its own namespace */
const NAMESPACES = [
	'leading-line-height',
	'paragraph-spacing',
	'text-size',
	'max-width',
	'spacing',
	'color',
	'radius',
	'shadow',
	'font',
	'aspect'
];

const VARIANT_NAME = new RegExp(`^(--[\\w-]+)-(${VARIANTS.join('|')})$`);

export const isSemanticGroup = (group: string) => /^semantic\b/i.test(group.trim());

export const namespaceOf = (name: string) => NAMESPACES.find((namespace) => name.startsWith(`--${namespace}-`)) ?? null;

/**
 * The layer, variants and design token groups of every token, by name
 *
 * @param groupId the id of a group in the protocol, by its label
 */
export function tokenLayers(defaults: DesignToken[], groupId: (group: string) => string): Map<string, TokenLayers> {
	const layers = new Map<string, TokenLayers>();
	const semantic = new Set(defaults.filter((token) => isSemanticGroup(token.group)).map((token) => token.name));

	// the design groups per namespace, in their order
	const designGroups = new Map<string, string[]>();
	for (const token of defaults) {
		const namespace = namespaceOf(token.name);
		if (semantic.has(token.name) || !namespace) {
			continue;
		}
		const groups = designGroups.get(namespace) ?? [];
		const id = groupId(token.group);
		if (!groups.includes(id)) {
			groups.push(id);
		}
		designGroups.set(namespace, groups);
	}

	for (const token of defaults) {
		if (!semantic.has(token.name)) {
			layers.set(token.name, { layer: 'design' });
			continue;
		}
		const namespace = namespaceOf(token.name);
		const pointsAt = namespace ? designGroups.get(namespace) : undefined;
		layers.set(token.name, { layer: 'semantic', ...(pointsAt?.length ? { pointsAt } : {}) });
	}

	for (const token of defaults) {
		const match = semantic.has(token.name) ? token.name.match(VARIANT_NAME) : null;
		const of = match?.[1];
		if (!match || !of || !semantic.has(of)) {
			continue;
		}
		const variant = layers.get(token.name);
		const base = layers.get(of);
		if (!variant || !base) {
			continue;
		}
		variant.variantOf = of;
		variant.variant = match[2];
		base.variants = [...(base.variants ?? []), { id: match[2], token: token.name }].sort(
			(a, b) => VARIANTS.indexOf(a.id as never) - VARIANTS.indexOf(b.id as never)
		);
	}

	return layers;
}
