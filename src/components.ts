import type { Component } from 'svelte';

type ComponentModule = { default: Component<Record<string, unknown>> };

/** the app's components: import.meta.glob<{ default: Component<…> }>('/src/lib/**\/*.svelte') */
export type ComponentModules = Record<string, () => Promise<ComponentModule>>;

/**
 * The items of the preview (server.ts preview) with their components, for the load of the preview page (+page.ts):
 * loaded there, so they are there on the server and in the browser (hydration)
 */
export function withComponents<Item extends { component: string }>(
	modules: ComponentModules,
	items: Item[]
): Promise<(Item & { Component: ComponentModule['default'] })[]> {
	return Promise.all(
		items.map(async (item) => {
			const load = modules[item.component];
			if (!load) {
				throw new Error(`No component ${item.component}`);
			}
			return { ...item, Component: (await load()).default };
		})
	);
}
