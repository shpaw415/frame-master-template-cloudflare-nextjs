"use dynamic";

import { useLoader } from "frame-master-plugin-cloudflare-pages-dynamic-ssr/client/hooks";
import {
	createLoader,
	createPageConfig,
} from "frame-master-plugin-cloudflare-pages-dynamic-ssr/server";

// Per-page cache configuration — cache each user page for 60 seconds.
// Remove or adjust ssr_configs to change TTL behaviour.
export const ssr_configs = createPageConfig({
	callback(_ctx) {
		return { ttl: 60 };
	},
});

// Server-side loader — reads the dynamic route parameter ":id" from the URL.
// The callback runs only on the server; it is never shipped to the browser.
export const loader_user = createLoader({
	name: "user",
	async callback(ctx) {
		// In a real app you would query a database or external API here.
		// ctx.env gives access to all Cloudflare bindings (KV, D1, R2, …).
		return {
			id: ctx.params.id,
			name: `User #${ctx.params.id}`,
			fetchedAt: new Date().toISOString(),
		};
	},
});

export default function UserPage() {
	const user = useLoader(loader_user);

	if (!user) return null;

	return (
		<main style={{ fontFamily: "sans-serif", padding: "2rem" }}>
			<h1>User — {user.name}</h1>
			<p>
				<strong>ID:</strong> {user.id}
			</p>
			<p>
				<strong>Server render time:</strong> {user.fetchedAt}
			</p>
			<p style={{ color: "#666", fontSize: "0.875rem" }}>
				This page was rendered server-side by{" "}
				<code>frame-master-plugin-cloudflare-pages-dynamic-ssr</code> and cached
				in Cloudflare KV for 60 seconds. On client-side navigation only the
				loader props are re-fetched — the full HTML is not re-rendered.
			</p>
		</main>
	);
}
