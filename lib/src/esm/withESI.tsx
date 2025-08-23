import React from "react";
import { createIncludeElement } from "./server";

export default function withESI<P>(
  WrappedComponent: React.ComponentType<P>,
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
    const ESIClient = React.lazy(() =>
      import("./withESI.client").then((m) => ({
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
      <React.Suspense fallback={null}>
        <ESIClient />
      </React.Suspense>
    );
  }

  // For debugging
  WithESI.displayName = `WithESI(${WrappedComponent.displayName || WrappedComponent.name || "Component"})`;

  return WithESI as React.ComponentType<any>;
}
