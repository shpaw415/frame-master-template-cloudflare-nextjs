import { getBuilder } from "frame-master/build";
import type { FrameMasterConfig } from "frame-master/server/types";
import ApplyReact from "frame-master-plugin-apply-react/plugin";
import AssetsToBuild from "frame-master-plugin-assets-to-build";
import AutoSiteMap from "frame-master-plugin-auto-sitemap";
import buildUnifier from "frame-master-plugin-build-unifier";
import SSRPlugin from "frame-master-plugin-cloudflare-pages-dynamic-ssr";
import CFActionPlugin from "frame-master-plugin-cloudflare-pages-functions-action";
import EnvInHTML from "frame-master-plugin-env-in-html";
import imageOptimizer from "frame-master-plugin-image-optimizer";
import ReactToHTML from "frame-master-plugin-react-to-html";
import SEOPlugin from "frame-master-plugin-seo";
import ServeFromBuild from "frame-master-plugin-serve-from-build";
import TailwindPlugin from "frame-master-plugin-tailwind";
import SVGLoader from "frame-master-svg-to-jsx-loader";
import SiteConfig from "./site.config";
import AsyncFallback from "./src/components/loading";

if (!process.env.WRANGLER_PORT) {
	throw new Error(
		"Please see rename the .env.exemple file to .env and make sure WRANGLER_PORT is set to the port your Wrangler dev server will run on.",
	);
}

const WranglerServerPort = Number(process.env.WRANGLER_PORT);

export default {
	HTTPServer: {
		port: 3000,
	},
	plugins: [
		ApplyReact({
			route: "src/pages",
			clientShellPath: "src/client-shell.tsx",
			entrypointExtensions: [".tsx", ".jsx"],
			style: "nextjs",
			fallbacks: {
				defaultLoadingComponentPath: "src/components/loading.tsx",
				defaultNotFoundComponentPath: "src/components/404.tsx",
			},
			hydration: "hydrate",
		}),
		ReactToHTML({
			verbose: false,
			srcDir: "src/pages",
			shellPath: "src/shell.tsx",
			entrypointExtensions: [".tsx", ".jsx"],
			asyncFallback: AsyncFallback,
		}),
		...buildUnifier({
			plugins: [
				CFActionPlugin({
					actionBasePath: "src/actions",
					outDir: ".frame-master/build",
					serverPort: WranglerServerPort,
				}),
				SSRPlugin({
					actionBasePath: "src/actions",
					basePath: "src/pages",
					wrangler: {
						port: WranglerServerPort,
					},
					entrypointMatcher: [/.*layout\.tsx$/],
				}),
			],
		}),
		{
			name: "proxy-to-wrangler",
			version: "0.1.0",
			serverConfig: {
				routes: {
					"/*": async (req) => {
						const url = new URL(req.url);
						url.port = String(WranglerServerPort);
						url.hostname = "127.0.0.1";
						const headers = new Headers(req.headers);
						headers.set("host", `127.0.0.1:${WranglerServerPort}`);
						headers.delete("accept-encoding");
						const hasBody =
							req.method !== "GET" &&
							req.method !== "HEAD" &&
							req.body !== null;
						try {
							const response = await fetch(url, {
								method: req.method,
								headers,
								body: hasBody ? req.body : undefined,
								redirect: "manual",
							});
							response.headers.delete("content-encoding");
							return response;
						} catch {
							return new Response("Bad Gateway: upstream unavailable", {
								status: 502,
							});
						}
					},
				},
			},
			build: {
				buildConfig: {
					splitting: true,
				},
			},
			async serverReady({ builder }) {
				await builder.build();
			},
		},

		ServeFromBuild({
			buildDir: ".frame-master/build",
			plainURLPaths: ["index.html"],
			buildOnDevStart: true,
		}),

		EnvInHTML({
			entries: ["NODE_ENV"],
		}),
		TailwindPlugin({
			inputFile: "static/tailwind.css",
			outputFile: "static/style.css",
			options: {
				autoInjectInBuild: true,
				runtime: "bun",
			},
		}),
		imageOptimizer({
			input: "images",
			output: "optimized",
			skipExisting: true,
			formats: ["webp"],
			keepOriginal: true,
			sizes: [320, 720, 1280],
		}),
		SVGLoader(),
		AssetsToBuild({
			paths: [
				{
					src: "optimized",
					dist: "optimized",
				},
				{
					src: "static/favicon.ico",
					dist: "favicon.ico",
				},
				{
					src: "assets",
					dist: "assets",
				},
				{
					src: "robots.txt",
					dist: "robots.txt",
				},
			],
		}),
		SEOPlugin(SiteConfig.SEO),
		AutoSiteMap({
			baseUrl: SiteConfig.siteUrl,
			authorizedExtensions: ["html"],
		}),
		{
			name: "static-assets",
			version: "1.0.0",
			build: {
				buildConfig: {
					naming: {
						asset: "[dir]/[name].[ext]",
					},
				},
			},
		},
		{
			name: "dev-plugin",
			version: "1.0.0",
			fileSystemWatchDir: ["src"],
			async onFileSystemChange(_ev, _fp, abs) {
				const builder = getBuilder();
				if (!abs.startsWith("src/") || builder?.isBuilding()) return;
				await builder?.build();
			},
		},
	],
} satisfies FrameMasterConfig;
