<script lang="ts">
	import type { Component } from 'svelte';
	import type { PreviewItem } from './server.ts';
	import Preview, { type FrameClasses } from './Preview.svelte';

	/**
	 * The preview page (server.ts preview, components.ts withComponents): the entries in data-styleguide-root, what the
	 * styleguide measures and reads the used tokens of. The app puts the tokens of the site into the <head> and draws
	 * its page grid next to it.
	 */
	let {
		items,
		frames = {}
	}: {
		items: (PreviewItem & { Component: Component<Record<string, unknown>> })[];
		frames?: FrameClasses;
	} = $props();
</script>

<div data-styleguide-root>
	{#each items as item (item.entry)}
		<Preview
			entry={item.entry}
			component={item.Component}
			props={item.props}
			frame={item.frame}
			width={item.width}
			{frames}
		/>
	{/each}
</div>
