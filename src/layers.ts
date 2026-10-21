import type { TokenLayer, TokenVariant } from './protocol.ts';
import type { DesignToken } from './tokens.ts';

/**
 * The layers of the tokens (PROTOCOL.md, "Layers and variants"), read from the conventions of the stylesheets, so there
 * is no second list to keep in sync:
 * - a group whose label starts with "Semantic" holds semantic tokens (what components use), every other group design
 *   tokens (the raw values of the design)
 * - a semantic token named like another one plus "-light", "-dark" (the color scheme) or "-base", "-md", "-lg", "-xl"
 *   (from that width) is a variant of it
 * - a semantic token points at the design groups its family uses: the groups of the design tokens that the tokens of
 *   its group (with the variant groups: "Semantic colors", "Semantic colors (light)", "… (dark)") refer to, of its
 *   namespace. So the colors of the site get the palette of the site, the colors of the event types their own; without
 *   any reference, every design group of its namespace
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

/** the family of a group: its label without the variant ("Semantic colors (light)" → "semantic colors") */
const familyOf = (group: string) => group.replace(/\s*\([^)]*\)\s*$/, '').trim().toLowerCase();

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

	// the design groups each family refers to, per namespace, in the order of the stylesheets
	const byName = new Map(defaults.map((token) => [token.name, token]));
	const referred = new Map<string, Set<string>>();
	for (const token of defaults) {
		if (!semantic.has(token.name)) {
			continue;
		}
		for (const [, name] of token.value.matchAll(/var\(\s*(--[\w-]+)/g)) {
			const target = byName.get(name);
			if (target && !semantic.has(name) && namespaceOf(name) === namespaceOf(token.name)) {
				const key = `${familyOf(token.group)} ${namespaceOf(name)}`;
				referred.set(key, (referred.get(key) ?? new Set()).add(groupId(target.group)));
			}
		}
	}

	for (const token of defaults) {
		if (!semantic.has(token.name)) {
			layers.set(token.name, { layer: 'design' });
			continue;
		}
		const namespace = namespaceOf(token.name);
		const all = namespace ? (designGroups.get(namespace) ?? []) : [];
		const used = referred.get(`${familyOf(token.group)} ${namespace}`);
		const pointsAt = used ? all.filter((group) => used.has(group)) : all;
		layers.set(token.name, { layer: 'semantic', ...(pointsAt.length ? { pointsAt } : {}) });
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
