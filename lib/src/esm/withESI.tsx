import { lazy, Suspense, type ComponentType } from "react";
import { createIncludeElement } from "./server.js";

export default function withESI<P>(
  WrappedComponent: ComponentType<P>,
  fragmentID: string
) {
  function WithESI(
    props: P & { esi?: { attrs?: { [key: string]: string | null } } }
  ) {
    // Server: return ESI include
    if (typeof window === "undefined") {
      return createIncludeElement(fragmentID, props, props?.esi || {});
    }

    // Client: lazy load client wrapper and render
    const ESIClient = lazy(() =>
      import("./withESI.client.js").then((m) => ({
        default: () =>
          m.ESIClientWrapper({
            WrappedComponent,
            fragmentID,
            esi: props?.esi,
            initialProps: undefined,
            ...props,
          } as any),
      }))
    );

    return (
      <Suspense fallback={null}>
        <ESIClient />
      </Suspense>
    );
  }

  // For debugging
  WithESI.displayName = `WithESI(${WrappedComponent.displayName || WrappedComponent.name || "Component"})`;

  return WithESI as ComponentType<any>;
}
