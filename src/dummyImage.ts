/**
 * Placeholder images of the styleguide: an image of the example data (e.g. a YAML tag "!image 1600x900" of the app)
 * gets the asset id dummyAsset(1600, 900), which carries the size. Components request its variants like any image
 * (?asset=…&width=…&ratio=…), at <basePath>/image instead of Neos: no assets needed, crops and srcsets stay real.
 */
export const DUMMY_ASSET = /^styleguide-dummy-(\d+)x(\d+)$/;

export const dummyAsset = (width: number, height: number) => `styleguide-dummy-${width}x${height}`;

export const isDummyAsset = (asset: string) => DUMMY_ASSET.test(asset);

export function dummyImageResponse(query: URLSearchParams): Response | null {
	const size = query.get('asset')?.match(DUMMY_ASSET);
	if (!size) {
		return null;
	}
	const [imageWidth, imageHeight] = [Number(size[1]), Number(size[2])];
	const width = Math.min(Number(query.get('width')) || imageWidth, 4000);
	const [ratioWidth, ratioHeight] = query.get('ratio')?.split(':').map(Number) ?? [imageWidth, imageHeight];
	const height = Math.round((width * ratioHeight) / ratioWidth) || imageHeight;
	// mountains and the size, like the placeholders of the Neos backend
	const svg =
		`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">` +
		`<rect width="100%" height="100%" fill="#999"/>` +
		`<path d="M0 ${height} L${width * 0.35} ${height * 0.45} L${width * 0.55} ${height * 0.7} L${width * 0.75} ${height * 0.35} L${width} ${height}Z" fill="#aaa"/>` +
		`<text x="50%" y="50%" fill="#fff" font-family="sans-serif" font-size="${Math.max(12, Math.round(width / 16))}" text-anchor="middle" dominant-baseline="middle">${width}×${height}</text>` +
		`</svg>`;
	return new Response(svg, { headers: { 'content-type': 'image/svg+xml', 'cache-control': 'public, max-age=86400' } });
}
