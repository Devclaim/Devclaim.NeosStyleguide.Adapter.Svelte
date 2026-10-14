/**
 * The design tokens: the CSS custom properties of the @theme blocks (Tailwind) of the app's stylesheets. The CSS is the
 * source, this reads it (name, default value, group, description), so there is no second list to keep in sync. A
 * comment "Group: <label> - <description>" starts a group, the comment behind a token describes it, other comments are
 * only comments. A site overrides tokens in Neos (the property "designTokens" of its site node, one "--name: value;"
 * per line): themeTokens() says which overrides are allowed and turns them into CSS.
 */

export type DesignToken = {
	/** "--color-brand" */
	name: string;
	/** the default, as written in the CSS: "var(--color-sd-50)" */
	value: string;
	/** the group of the token: the last "Group: <label> - <description>" comment above it ("Semantic colors") */
	group: string;
	/** the description of the group: "the only colors components use" */
	groupDescription: string;
	/** the comment behind the token: "primary actions (buttons)" */
	description: string;
};

/**
 * Tokens Tailwind uses at build time, in media queries: a CSS custom property cannot change them, so a site cannot
 * override them.
 */
export const BUILD_TIME_TOKEN = /^--(breakpoint|container)-/;

const THEME_BLOCK = /@theme(?:\s+[\w\s]+)?\s*\{([\s\S]*?)\n\}/g;
const COMMENT = /^\/\*([\s\S]*?)\*\/$/;
const DECLARATION = /^(--[\w-]+)\s*:\s*([\s\S]+?);\s*(?:\/\*\s*([\s\S]*?)\s*\*\/)?$/;

/** the tokens of the @theme blocks of a stylesheet, in their order */
export function parseThemeTokens(css: string): DesignToken[] {
	const tokens: DesignToken[] = [];
	for (const [, block] of css.matchAll(THEME_BLOCK)) {
		let group = '';
		let groupDescription = '';
		// statements: comments and declarations (a declaration may span lines)
		const statements = block.match(/\/\*[\s\S]*?\*\/|[^;/]+(?:\/(?!\*)[^;/]*)*;(?:[ \t]*\/\*[\s\S]*?\*\/)?/g) ?? [];
		for (const statement of statements.map((text) => text.trim())) {
			const comment = statement.match(COMMENT);
			if (comment) {
				// the line "Group: <label> - <description>" of the comment (more lines are only for developers)
				const line = comment[1]
					.split('\n')
					.map((text) => text.replace(/^[ \t]*\*?[ \t]*/, '').trim())
					.find((text) => text.startsWith('Group:'));
				const groupComment = line?.match(/^Group:\s*(.+?)(?:\s+-\s+(.*))?$/);
				if (groupComment) {
					group = groupComment[1].trim();
					groupDescription = groupComment[2]?.trim() ?? '';
				}
				continue;
			}
			const declaration = statement.match(DECLARATION);
			if (declaration) {
				const [, name, value, description = ''] = declaration;
				tokens.push({ name, value: value.replace(/\s+/g, ' ').trim(), group, groupDescription, description });
			}
		}
	}
	return tokens;
}

/** a site may only reference tokens in var(), and nothing that leaves the declaration or the <style> element */
const UNSAFE_VALUE = /[;{}<>\\@]|\/\*|url\(|expression\(/i;
const MAX_VALUE_LENGTH = 300;

export type TokenOverrides = {
	/** "--color-brand:#e5007d;--font-sans:…", ready for a :root rule; empty without valid overrides */
	css: string;
	/** lines that were left out, with the reason (e.g. for the dev server log) */
	ignored: string[];
};

export type ThemeTokens = {
	/** the defaults of all tokens, in the order of the stylesheets */
	defaults: DesignToken[];
	/** whether a site may change the token (not a build time token) */
	editable: (name: string) => boolean;
	/** why a declaration of a site cannot be taken, or null (also the validation of the styleguide) */
	rejection: (name: string, value: string) => string | null;
	/**
	 * The overrides of a site (one "--name: value;" per line) as CSS. Only tokens of the @theme blocks are taken, no
	 * build time tokens (breakpoints), and only values that cannot break out of the declaration; var() may only
	 * reference known tokens.
	 */
	overrides: (designTokens: string | null | undefined) => TokenOverrides;
};

/** the tokens of the stylesheets (their source, e.g. imported with ?raw) and the rules for the overrides of a site */
export function themeTokens(stylesheets: string[]): ThemeTokens {
	const defaults = stylesheets.flatMap(parseThemeTokens);
	const known = new Set(defaults.map((token) => token.name));
	const editable = (name: string) => !BUILD_TIME_TOKEN.test(name);

	function rejection(name: string, value: string): string | null {
		if (!known.has(name)) {
			return 'unknown token';
		}
		if (!editable(name)) {
			return 'used at build time (media queries), cannot be changed per site';
		}
		if (value === '' || value.length > MAX_VALUE_LENGTH || UNSAFE_VALUE.test(value)) {
			return 'value not allowed';
		}
		if ([...value.matchAll(/var\(\s*(--[\w-]+)/g)].some(([, reference]) => !known.has(reference))) {
			return 'var() references an unknown token';
		}
		return null;
	}

	function overrides(designTokens: string | null | undefined): TokenOverrides {
		const declarations: string[] = [];
		const ignored: string[] = [];
		for (const line of (designTokens ?? '').split(/\r?\n/)) {
			const text = line.trim().replace(/;$/, '').trim();
			if (text === '') {
				continue;
			}
			const match = text.match(/^(--[\w-]+)\s*:\s*(.+)$/);
			const reason = match ? rejection(match[1], match[2].trim()) : 'not "--name: value"';
			if (reason || !match) {
				ignored.push(`${text} (${reason})`);
			} else {
				declarations.push(`${match[1]}:${match[2].trim()}`);
			}
		}
		return { css: declarations.join(';'), ignored };
	}

	return { defaults, editable, rejection, overrides };
}
