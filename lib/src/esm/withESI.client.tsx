"use client";
export {};

import React, { useEffect, useState } from "react";

interface IWithESIClientProps {
  WrappedComponent: React.ComponentType<any>;
  fragmentID: string;
  esi?: { attrs?: { [key: string]: string | null } };
  initialProps?: object;
}

export function ESIClientWrapper({
  WrappedComponent,
  fragmentID,
  esi,
  initialProps,
  ...rest
}: IWithESIClientProps & Record<string, unknown>) {
  const { ...initialChildProps } = rest as Record<string, unknown>;
  const [childProps, setChildProps] = useState<object>({
    ...initialProps,
    ...initialChildProps,
  });
  const [loaded, setLoaded] = useState<boolean>(true);

  useEffect(() => {
    if ((window as any).__REACT_ESI__?.[fragmentID]) {
      setChildProps({
        ...(window as any).__REACT_ESI__[fragmentID],
        ...childProps,
      });
      return;
    }

    if ((WrappedComponent as any).getInitialProps) {
      setLoaded(false);
      (WrappedComponent as any)
        .getInitialProps({ props: childProps })
        .then((initial: object) => {
          setChildProps(initial);
          setLoaded(true);
        });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!loaded) {
    return null;
  }

  return <WrappedComponent {...(childProps as any)} />;
}
