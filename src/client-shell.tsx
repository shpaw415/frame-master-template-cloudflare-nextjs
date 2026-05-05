// ClientWrapper is used client side only for state management
// you can create your own version of the routerHost

import { RouterHost } from "frame-master-plugin-apply-react/router";
import { SSRPropsProvider } from "frame-master-plugin-cloudflare-pages-dynamic-ssr/client/context";
import type { PropsData } from "frame-master-plugin-cloudflare-pages-dynamic-ssr/provider/utils";
import { type JSX, StrictMode, useRef, useState } from "react";

export default function ClientWrapper({ children }: { children: JSX.Element }) {
	const routeChangePromiseRef = useRef<Promise<Array<PropsData> | null> | null>(
		null,
	);
	const [pathname, setPathname] = useState(window.location.pathname);
	const [devKey, setDevKey] = useState(0);

	return (
		<StrictMode>
			<SSRPropsProvider
				pathname={pathname}
				promiseRef={routeChangePromiseRef}
				devKey={devKey}
			>
				<RouterHost
					onRouteChange={async (match) => {
						setPathname(match.pathname);
						if (process.env.NODE_ENV === "development") {
							setDevKey((prev) => prev + 1);
						}
						await routeChangePromiseRef.current;
					}}
				>
					{children}
				</RouterHost>
			</SSRPropsProvider>
		</StrictMode>
	);
}
