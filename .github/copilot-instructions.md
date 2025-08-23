# AI agent guide for `react-esi`

**What it is:** A tiny TypeScript library that accelerates SSR for React/Next by emitting **ESI** fragments server-side and hydrating them client-side. The repo includes runnable **Express** and **Next** examples that sit behind **Varnish** (via Docker) for real ESI processing.

---

## The big picture

- **HOC**: `withESI` wraps a React component.

  - **On the server** it renders an `<esi:include>` tag pointing to a signed internal URL for that fragment.
  - **In the browser** it renders the wrapped component, using initial props injected by the server when available.

- **Server controller**: `serveFragment(req, res, resolve)` handles the internal fragment route: it calls your resolver to get the component for a given `fragmentID`, invokes its `getInitialProps` (if present), injects the result via an inline `<script>`, then streams the HTML.
- **Configuration**:

  - `REACT_ESI_PATH` (default `/_fragment`) – internal route to serve fragments.
  - `REACT_ESI_SECRET` – secret to sign fragment URLs (keep it stable across restarts & nodes)

---

## Public API cheatsheet

### `withESI(WrappedComponent, fragmentID)`

Wraps any component to turn it into an ESI fragment on the server and a normal component on the client.

```tsx
import withESI from "react-esi/lib/withESI";
import { type ComponentType } from "react";

type Props = { greeting: string };

function Hello(props: Props) {
  return <h2>{props.greeting}</h2>;
}

export const HelloESI = withESI(Hello as ComponentType<Props>, "HelloFragment");
```

- **`fragmentID`** must be unique per instance if you render the same component multiple times.
- **ESI attributes** (e.g. `alt`, `onerror`) can be passed via a prop named `esi.attrs`:

  ```tsx
  <HelloESI
    greeting="Hi"
    esi={{ attrs: { alt: "fallback", onerror: "continue" } }}
  />
  ```

  These attributes are attached to the generated `<esi:include>`.

### `static async getInitialProps(ctx)`

Optional method on your wrapped component to compute initial, **JSON-serializable** props.

```tsx
type Ctx<P> = {
  props: P;
  req?: import("http").IncomingMessage;
  res?: import("http").ServerResponse;
};

Hello.getInitialProps = async ({ props, res }: Ctx<Props>) => {
  // Set a per-fragment TTL:
  res?.setHeader("Cache-Control", "s-maxage=60, max-age=30");
  return { ...props, greeting: props.greeting.toUpperCase() };
};
```

- Runs **server-side** during fragment rendering and the result is injected into the HTML.
- If server props weren’t injected (e.g. a client-only render), it runs **once on the client**.
- **Return value must be `JSON.stringify`-safe** (avoid `Map`, `Set`, `Symbol`, etc.).

### Server API

```ts
import express from "express";
import { serveFragment, path as REACT_ESI_PATH } from "react-esi/lib/server";

const app = express();

// Optional: announce ESI support to proxies
app.use((_req, res, next) => {
  res.set("Surrogate-Control", 'content="ESI/1.0"');
  next();
});

// Internal fragment route (default "/_fragment")
app.get(REACT_ESI_PATH, (req, res) =>
  serveFragment(req, res, (fragmentID, props) => {
    // Resolve the component for this fragmentID
    // Keep server-only imports inside this callback.
    const Component = require(`./components/${fragmentID}`).default;
    return Component;
  })
);
```

- **Route**: expose exactly one route at `REACT_ESI_PATH`; don’t publish it through your public router/CDN.
- **Resolver**: `resolve(fragmentID, props, req, res)` returns the **component type** to render.
- You typically **don’t call internal URL/signing helpers directly**; the HOC+controller pair handles it end-to-end.

---

## Data, caching & headers

- **Per-fragment TTL**: set `Cache-Control` inside `getInitialProps` to control the fragment’s cache.
  Example: `s-maxage=60, max-age=30`.
- **ESI on proxy/CDN**:

  - Varnish/Akamai/Fastly/Cloudflare Workers all understand ESI.
  - In dev, you can run the example stack with Varnish (see below).

- **Cookies will bust your cache**: most proxies skip cache when any cookie is present. Clear local cookies when testing, or configure your proxy to ignore irrelevant cookies.
- **Cache tags / invalidation**: possible with your proxy (see README links); out of scope for the HOC itself.

---

## Integration recipes

### Next.js custom server

Use Express as a custom Next server and mount the fragment route:

```ts
// server.ts
import express from "express";
import next from "next";
import { serveFragment, path as REACT_ESI_PATH } from "react-esi/lib/server";

const dev = process.env.NODE_ENV !== "production";
const app = next({ dev });
const handle = app.getRequestHandler();
const server = express();

server.use((_req, res, next) => {
  res.set("Surrogate-Control", 'content="ESI/1.0"');
  next();
});

server.get(REACT_ESI_PATH, (req, res) =>
  serveFragment(req, res, (id) => require(`./components/${id}`).default)
);

server.get("*", (req, res) => handle(req, res));
app.prepare().then(() => server.listen(3000));
```

> Note: with a custom server, run Next with `node server.ts/js` (not `next dev`).

### Express (vanilla React)

Same as above, but your app routes are plain Express routes. The fragment route is identical.

---

## Environment variables

- `REACT_ESI_SECRET` – HMAC secret used to sign fragment URLs. **Set this explicitly and keep it stable** across restarts and instances.
- `REACT_ESI_PATH` – internal path that serves fragments (default `/_fragment`).

---

## Repo layout & dev workflow

- **Library code**: `lib/src/*` (notably `withESI.tsx`, `server.tsx`). Built output under `lib/lib/*`.
- **Examples**: `examples/express`, `examples/next` – each ships a `docker compose` + Varnish config to demo real ESI.
- **Scripts** (pnpm workspace):

  ```sh
  pnpm --filter=react-esi install
  pnpm --filter=react-esi run lint
  pnpm --filter=react-esi run typecheck
  pnpm --filter=react-esi run build
  pnpm --filter=react-esi run test
  pnpm --filter=react-esi run build:watch
  ```

- **Run the demos**:

  ```sh
  # from examples/{express,next}
  docker compose up -d        # boots Varnish + the app
  ```

- **CI**: see `.github/workflows/test.yml` for lint/typecheck/build/test matrix.

> For exact peer deps/engines (React/ReactDOM/TypeScript/Node), **check `package.json` in this repo**.

---

## Gotchas & best practices

- **Fragment IDs** must be unique per rendered instance (don’t reuse the same `fragmentID` for multiple different component instances on a page).
- **Props must be serializable** by `JSON.stringify` (no `Map`, `Set`, `Symbol`, functions, class instances).
- **Guard server-only imports** in your resolver (dynamic `require` inside the resolver callback) so bundlers don’t pull server code into client bundles.
- **Keep the internal route private**: don’t expose `REACT_ESI_PATH` on the public router/CDN; it should be consumed only by your proxy doing the ESI fetch.
- **Surrogate-Control** header: sending `content="ESI/1.0"` helps some proxies auto-enable ESI (optional for Varnish depending on config).

---

## When adding features/changes

- Preserve the contract of `withESI` + `getInitialProps` and the server controller’s signature `serveFragment(req, res, resolve)`.
- Keep server-only code behind dynamic requires or file-level boundaries (don’t leak server deps into client bundles).
- Add tests under the appropriate area (server/client) and run `pnpm --filter=react-esi test`.

---

## Handy pointers

- **Core files**: `lib/src/withESI.tsx`, `lib/src/server.tsx`
- **Examples**: `examples/express`, `examples/next`
- **Docs**: repository `README.md` (usage, env vars, ESI attrs, troubleshooting)

---

### Minimal end-to-end snippet

```tsx
// 1) Wrap your component
import withESI from "react-esi/lib/withESI";
export const FooterESI = withESI(Footer, "Footer");

// 2) Compute props + TTL
Footer.getInitialProps = async ({ res }) => {
  res?.setHeader("Cache-Control", "s-maxage=300, max-age=60");
  return {
    /* serializable props */
  };
};

// 3) Mount the fragment route on the server
import { serveFragment, path as REACT_ESI_PATH } from "react-esi/lib/server";
app.get(REACT_ESI_PATH, (req, res) =>
  serveFragment(req, res, (id) => require(`./components/${id}`).default)
);

// 4) Render it in your page (server emits <esi:include .../>)
<FooterESI esi={{ attrs: { onerror: "continue" } }} />;
```

---

## Troubleshooting quickies

- **“Cache never hits”** → you probably have cookies. Clear them for the local origin or configure the proxy to ignore irrelevant cookies.
- **“Props are missing on the client”** → ensure `getInitialProps` returns JSON-serializable data and that your fragment ID matches the resolver’s component.
- **“Invalid fragment URL / signature”** → set `REACT_ESI_SECRET` consistently across all servers and keep `REACT_ESI_PATH` unchanged.
