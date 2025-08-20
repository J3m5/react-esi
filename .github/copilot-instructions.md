# React ESI Development Instructions

Always reference these instructions first and fallback to search or bash commands only when you encounter unexpected information that does not match the info here.

React ESI is a TypeScript library for React and Next.js that provides blazing-fast server-side rendering using Edge Side Includes (ESI). The repository uses pnpm workspaces with a main library and two example applications demonstrating Express and Next.js integration.

## How React ESI Works

React ESI enables **component-level caching** for server-side rendered React applications by leveraging Edge Side Includes (ESI), a W3C standard supported by most CDNs and cache proxies.

### Core Architecture

**1. Component Wrapping with HOC**
- Components are wrapped with `withESI(Component, "FragmentID")` Higher Order Component
- Server-side: HOC renders `<esi:include src="/_fragment?fragment=FragmentID&props=...&sign=...">` tags
- Client-side: HOC renders the actual component with server-computed props

**2. Fragment Generation Pipeline**
- Each ESI-wrapped component gets a unique, signed URL endpoint (e.g., `/_fragment?fragment=MyFragment&props=...&sign=...`)
- The fragment handler (`lib/src/server.tsx`) serves individual component HTML + JavaScript injection script
- URLs are cryptographically signed with `REACT_ESI_SECRET` to prevent tampering
- Props are JSON-serialized and passed through the URL parameters

**3. Cache Layer Integration**
- ESI-compatible caches (Varnish, Cloudflare Workers, Akamai, Fastly) fetch fragments independently
- Each fragment can have its own `Cache-Control` headers and TTL via component's `getInitialProps()`
- Cache assembles the final page by replacing `<esi:include>` tags with fetched fragment content
- Highly dynamic components can be cached for seconds while static components cache for hours

**4. Client-Side Hydration**
- Fragment responses include `<script>window.__REACT_ESI__[fragmentID] = {...props}</script>`
- Client-side React components reuse server-computed props from `window.__REACT_ESI__`
- `getInitialProps()` is called server-side only; client-side uses cached props for instant hydration
- Seamless transition from server-rendered fragments to interactive React components

### Performance Benefits

**Edge Caching**: After first render, fragments are served in milliseconds from edge servers close to users
**Selective Invalidation**: Different components can have different cache lifetimes (TTLs)
**Reduced Server Load**: Only cache misses hit the origin server; cache hits are served directly by the edge
**SEO Optimized**: Full server-side rendering with component-level caching granularity

### Request Flow Example

1. User requests `/` → Cache server receives request
2. Page contains `<esi:include src="/_fragment?fragment=Header&props={}&sign=abc123">`
3. Cache checks if Header fragment is cached and valid (TTL not expired)
4. **Cache Hit**: Serve cached fragment → **Cache Miss**: Fetch from origin server's `/_fragment` endpoint
5. Origin server renders Header component, calls `getInitialProps()`, returns `<script>window.__REACT_ESI__...</script><header>...</header>`
6. Cache assembles final page by replacing ESI tags with fragments
7. Client receives fully-rendered HTML, React hydrates with pre-computed props

## Working Effectively

### Bootstrap and Dependencies
- **Install pnpm**: `curl -fsSL https://get.pnpm.io/install.sh | sh -` then `source ~/.bashrc`
- **Install all dependencies**: `pnpm install` -- takes 25 seconds. NEVER CANCEL. Set timeout to 60+ seconds.

### Build Commands
- **Main library build**: 
  - `pnpm --filter=react-esi run lint` -- takes 2 seconds
  - `pnpm --filter=react-esi run typecheck` -- takes 3 seconds  
  - `pnpm --filter=react-esi run build` -- takes 5 seconds
  - `pnpm --filter=react-esi run test` -- takes 5 seconds
- **Express example build**: `pnpm --filter=esi-express run build` -- takes 8 seconds
- **Next.js example build**: `pnpm --filter=esi-next run build` -- takes 45 seconds. NEVER CANCEL. Set timeout to 90+ seconds.

### Development Servers
- **Express example**: `pnpm --filter=esi-express run dev` -- starts on http://localhost:3000
- **Next.js example**: `pnpm --filter=esi-next run dev` -- starts on http://localhost:3000
- Only run one example at a time as they use the same port

### Production Mode
- **Express example**: `pnpm --filter=esi-express run start` -- requires build first
- **Next.js example**: `pnpm --filter=esi-next run start` -- requires build first

## Validation

### Always Run Before Changes
- `pnpm --filter=react-esi run lint` and `pnpm --filter=react-esi run typecheck` before making any changes
- `pnpm --filter=react-esi run test` to ensure existing tests pass

### Manual Validation Scenarios
After making changes, ALWAYS test these complete end-to-end scenarios:

1. **Fragment Generation Test**:
   - Start Express dev server: `pnpm --filter=esi-express run dev`
   - Verify main page loads: `curl http://localhost:3000/`
   - Should contain `<esi:include src="/_fragment?fragment=MyFragment&props=...&sign=...">`
   - Test fragment endpoint directly using the URL from the main page response
   - Fragment should return: `<script>window.__REACT_ESI__...</script><section>...` 

2. **Next.js Integration Test**:
   - Start Next.js dev server: `pnpm --filter=esi-next run dev`  
   - Verify main page loads with ESI includes
   - Check that Next.js development features work alongside ESI

3. **Production Build Test**:
   - Build express: `pnpm --filter=esi-express run build`
   - Start production: `pnpm --filter=esi-express run start`
   - Verify production bundle works with same fragment behavior

### Critical Validation Steps
- ALWAYS verify that `/_fragment` endpoint returns both the JavaScript injection script AND the rendered HTML
- ALWAYS check that cache headers are set properly on fragment responses (look for `Cache-Control` headers)
- ALWAYS test that ESI includes contain properly signed URLs (the `sign` parameter must be valid)

## Repository Structure

### Key Directories
```
/home/runner/work/react-esi/react-esi/
├── lib/                          # Main react-esi library
│   ├── src/                      # TypeScript source code
│   ├── package.json              # Library package.json
│   └── jest.config.ts            # Test configuration
├── examples/
│   ├── express/                  # Express.js example
│   │   ├── src/                  # Express source code
│   │   └── compose.yaml          # Docker compose with Varnish
│   └── next/                     # Next.js example
│       ├── pages/                # Next.js pages
│       ├── components/           # React components
│       └── compose.yaml          # Docker compose with Varnish
├── package.json                  # Root workspace configuration
└── pnpm-workspace.yaml          # pnpm workspace configuration
```

### Important Files
- `lib/src/withESI.tsx` -- Main HOC for wrapping components
- `lib/src/server.tsx` -- Server-side fragment handler
- `examples/express/src/server.tsx` -- Express integration example
- `examples/next/server.tsx` -- Next.js custom server
- `.github/workflows/test.yml` -- CI pipeline configuration

## Environment Variables

React ESI uses these environment variables:
- `REACT_ESI_SECRET` -- Secret key for signing fragment URLs (default: random string) 
- `REACT_ESI_PATH` -- Internal fragment path (default: `/_fragment`)

## Docker and Production

### Full Stack with Varnish
- **Express with Varnish**: `cd examples/express && docker compose up -d` -- serves on port 8080
- **Next.js with Varnish**: `cd examples/next && docker compose up -d` -- serves on port 8090  
- Docker builds may fail in restricted networks due to certificate issues

### Docker Targets
- `express-prod` -- Production Express app
- `next-prod` -- Production Next.js app
- Both include optimized builds and proper Node.js production setup

## Common Tasks

### After Library Changes
1. `pnpm --filter=react-esi run build` to rebuild the library
2. Test both examples to ensure they work with your changes
3. `pnpm --filter=react-esi run test` to run unit tests
4. Always manually validate fragment generation as described above

### After Example Changes  
1. Rebuild the specific example: `pnpm --filter=esi-express run build` or `pnpm --filter=esi-next run build`
2. Test in both development and production modes
3. Verify Docker compose still works if you changed configuration

### Before Committing
- `pnpm --filter=react-esi run lint` -- must pass or CI will fail
- `pnpm --filter=react-esi run typecheck` -- must pass or CI will fail  
- `pnpm --filter=react-esi run test` -- must pass or CI will fail
- Manual validation of at least one complete fragment generation scenario

## Troubleshooting

### Fragment URLs Not Working
- Check that `REACT_ESI_SECRET` is consistent between renders
- Verify the URL signature is properly generated using the current secret
- Clear browser cookies if testing locally (cookies prevent cache hits)

### Build Failures
- Ensure you're using the correct pnpm filter: `--filter=react-esi`, `--filter=esi-express`, `--filter=esi-next`
- Check Node.js version is >= 20.11.0 as specified in package.json engines
- Run `pnpm install` if dependencies seem out of sync

### Cache Not Working
- Varnish and other cache proxies ignore requests with cookies by default
- Clear all cookies for localhost when testing  
- Check Varnish configuration in `examples/*/default.vcl`

### Development Server Conflicts
- Only run one example server at a time (both use port 3000)
- Kill any running servers before starting a new one
- Use `lsof -i :3000` to check what's using the port

## Quick Reference Commands

```bash
# Setup
curl -fsSL https://get.pnpm.io/install.sh | sh - && source ~/.bashrc
pnpm install

# Library development
pnpm --filter=react-esi run lint
pnpm --filter=react-esi run typecheck  
pnpm --filter=react-esi run build
pnpm --filter=react-esi run test

# Express example
pnpm --filter=esi-express run build
pnpm --filter=esi-express run dev     # Development
pnpm --filter=esi-express run start   # Production

# Next.js example  
pnpm --filter=esi-next run build       # Takes 45 seconds
pnpm --filter=esi-next run dev         # Development
pnpm --filter=esi-next run start       # Production

# Docker (if network allows)
cd examples/express && docker compose up -d    # Port 8080
cd examples/next && docker compose up -d       # Port 8090
```