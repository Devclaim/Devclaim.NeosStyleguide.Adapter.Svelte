<script lang="ts" module>
	import type { ClassValue } from 'svelte/elements';
	import type { Frame } from './catalogue.ts';

	/** the classes of the frames, from the app (its padding, its page grid) */
	export type FrameClasses = Partial<Record<Frame, ClassValue>>;
</script>

<script lang="ts">
	import { type Component, createRawSnippet } from 'svelte';

	/** One entry of the styleguide with its props (catalogue.ts componentProps: a content element its node) */
	let {
		entry,
		component: Content,
		props,
		frame = 'padded',
		width = null,
		frames = {}
	}: {
		entry: string;
		component: Component<Record<string, unknown>>;
		props: Record<string, unknown>;
		frame?: Frame;
		width?: number | null;
		frames?: FrameClasses;
	} = $props();

	// a text "children" becomes the content of the component, e.g. the label of a Link
	const children = $derived.by(() => {
		const html = props.children;
		return typeof html === 'string' ? createRawSnippet(() => ({ render: () => `<span>${html}</span>` })) : undefined;
	});
	const contentProps = $derived(children ? { ...props, children } : props);
</script>

<!-- data-styleguide-entry: one entry of the page, the styleguide finds it by it (PROTOCOL.md "Preview"); the width is
	the width of the content (content-box: without the padding of the frame) -->
<div
	data-styleguide-entry={entry}
	class={frames[frame]}
	style:box-sizing={width ? 'content-box' : undefined}
	style:max-width={width ? `${width}px` : undefined}
>
	<Content {...contentProps} />
</div>
