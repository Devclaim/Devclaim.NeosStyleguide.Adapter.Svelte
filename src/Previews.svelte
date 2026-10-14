<script lang="ts" module>
	import type { ClassValue } from 'svelte/elements';
	import type { Frame } from './catalogue.ts';

	/** the classes of the frames, from the app (its padding, its page grid) */
	export type FrameClasses = Partial<Record<Frame, ClassValue>>;
</script>

<script lang="ts">
	import { type Component, createRawSnippet } from 'svelte';
	import type { PreviewItem } from './server.ts';

	/**
	 * The preview page (server.ts preview, components.ts withComponents): the entries in data-styleguide-root, what the
	 * styleguide measures and reads the used tokens of. The app puts the tokens of the site into the <head> and draws
	 * its page grid next to it. (One component: Vite's dependency scan cannot follow imports between the .svelte files
	 * of a package.)
	 */
	let {
		items,
		frames = {}
	}: {
		items: (PreviewItem & { Component: Component<Record<string, unknown>> })[];
		frames?: FrameClasses;
	} = $props();

	/** a text "children" becomes the content of the component, e.g. the label of a Link */
	function contentProps(props: Record<string, unknown>): Record<string, unknown> {
		const html = props.children;
		return typeof html === 'string'
			? { ...props, children: createRawSnippet(() => ({ render: () => `<span>${html}</span>` })) }
			: props;
	}
</script>

<div data-styleguide-root>
	{#each items as item (item.entry)}
		{@const Content = item.Component}
		<!-- data-styleguide-entry: one entry of the page, the styleguide finds it by it (PROTOCOL.md "Preview"); the width
			is the width of the content (content-box: without the padding of the frame) -->
		<div
			data-styleguide-entry={item.entry}
			class={frames[item.frame]}
			style:box-sizing={item.width ? 'content-box' : undefined}
			style:max-width={item.width ? `${item.width}px` : undefined}
		>
			<Content {...contentProps(item.props)} />
		</div>
	{/each}
</div>
