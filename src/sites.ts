import { error } from '@sveltejs/kit';

/** a site as the core's Neos API returns it (Devclaim.NeosStyleguide, /api/styleguide/v1/sites) */
export type NeosSite = {
	/** the node name of the site */
	key: string;
	title: string;
	languages: { code: string; label: string }[];
	/** the token overrides of the site in the editor's workspace, one "--name: value;" per line */
	designTokens: string | null;
};

export type StyleguideSite = Omit<NeosSite, 'designTokens'> & {
	/** the token overrides as CSS declarations */
	tokenCss: string;
};

/**
 * The sites as the logged-in editor sees them, from the core's Neos API. fetch must send the editor's Neos session
 * (the app's handleFetch passes the cookie on for <basePath>). Without a backend session: 401, which makes the
 * interface ask for the login.
 */
export async function getSites(
	fetch: typeof globalThis.fetch,
	neosApiUrl: string,
	tokenCss: (designTokens: string | null) => string
): Promise<StyleguideSite[]> {
	const response = await fetch(`${neosApiUrl}/api/styleguide/v1/sites`, {
		headers: { accept: 'application/json' },
		redirect: 'manual'
	});
	// without a valid session Neos redirects to its login page, or answers 401 (JSON); 403 without the privilege
	if (response.status === 401 || (response.status >= 300 && response.status < 400)) {
		error(401, 'Not logged in');
	}
	if (!response.ok) {
		console.error(`Neos API styleguide/sites ${response.status}`, (await response.text()).slice(0, 2000));
		error(response.status === 403 ? 403 : 502, `Neos API responded with ${response.status}`);
	}
	const { sites } = (await response.json()) as { sites: NeosSite[] };
	return sites.map(({ designTokens, ...site }) => ({ ...site, tokenCss: tokenCss(designTokens) }));
}

/** the site of the interface's site selector, the first one by default */
export const pickSite = (sites: StyleguideSite[], key: string | null) =>
	sites.find((site) => site.key === key) ?? sites[0] ?? null;
