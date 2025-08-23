import crypto from "crypto";
import type { Transform } from "stream";
import { Readable } from "stream";
import { createElement, type ComponentType } from "react";
import type { PipeableStream } from "react-dom/server";
import { renderToPipeableStream } from "react-dom/server";

export const path = process.env.REACT_ESI_PATH || "/_fragment";
const secret =
  process.env.REACT_ESI_SECRET || crypto.randomBytes(64).toString("hex");

// expose path also as default export compatibility
export default { path };

function sign(url: URL) {
  const hmac = crypto.createHmac("sha256", secret);
  hmac.update(url.pathname + url.search);
  return hmac.digest("hex");
}

interface IEsiAttrs {
  src?: string;
  alt?: string;
  onerror?: string;
}

interface IEsiProps {
  attrs?: IEsiAttrs;
}

export const createIncludeElement = (
  fragmentID: string,
  props: object,
  esi: IEsiProps
) => {
  const esiAt = esi.attrs || {};

  const url = new URL(path, "http://example.com");
  url.searchParams.append("fragment", fragmentID);
  url.searchParams.append("props", JSON.stringify(props));
  url.searchParams.append("sign", sign(url));

  esiAt.src = url.pathname + url.search;

  return createElement("esi:include", esiAt);
};

interface IServeFragmentOptions {
  pipeStream?: (stream: PipeableStream) => InstanceType<typeof Transform>;
}

type Resolver = (
  fragmentID: string,
  props: object,
  req: any,
  res: any
) => ComponentType<any>;

export async function serveFragmentExpress(
  req: { url: string },
  res: any,
  resolve: Resolver,
  options: IServeFragmentOptions = {}
) {
  const url = new URL(req.url, "http://example.com");
  const expectedSign = url.searchParams.get("sign");

  url.searchParams.delete("sign");

  if (sign(url) !== expectedSign) {
    res.status(400);
    res.send("Bad signature");
    return;
  }

  const rawProps = url.searchParams.get("props");
  const props = rawProps ? JSON.parse(rawProps) : {};

  const fragmentID = url.searchParams.get("fragment") || "";

  const Component = resolve(fragmentID, props, req, res);
  const { ...baseChildProps } = props;

  const childProps =
    "getInitialProps" in Component &&
    typeof (Component as any).getInitialProps === "function"
      ? await (Component as any).getInitialProps({
          props: baseChildProps,
          req,
          res,
        })
      : baseChildProps;

  const encodedProps = JSON.stringify(childProps).replace(/</g, "\\u003c");

  const script = `<script>window.__REACT_ESI__ = window.__REACT_ESI__ || {}; window.__REACT_ESI__['${fragmentID}'] = ${encodedProps};document.currentScript.remove();</script>`;
  const scriptStream = Readable.from(script);
  scriptStream.pipe(res, { end: false });

  const stream = renderToPipeableStream(createElement(Component, childProps));

  const lastStream = options.pipeStream ? options.pipeStream(stream) : stream;

  lastStream.pipe(res);
}

// Minimal Next.js adapter using Web Streams API
export async function serveFragmentNext(request: Request, resolve: Resolver) {
  // Note: This adapter returns a Response with a ReadableStream body
  const url = new URL(request.url);
  const expectedSign = url.searchParams.get("sign");

  url.searchParams.delete("sign");

  if (sign(url) !== expectedSign) {
    return new Response("Bad signature", { status: 400 });
  }

  const rawProps = url.searchParams.get("props");
  const props = rawProps ? JSON.parse(rawProps) : {};

  const fragmentID = url.searchParams.get("fragment") || "";

  const Component = resolve(fragmentID, props, request, null);
  const { ...baseChildProps } = props;

  const childProps =
    "getInitialProps" in Component &&
    typeof (Component as any).getInitialProps === "function"
      ? await (Component as any).getInitialProps({
          props: baseChildProps,
          req: request,
          res: null,
        })
      : baseChildProps;

  const encodedProps = JSON.stringify(childProps).replace(/</g, "\\u003c");

  const script = `<script>window.__REACT_ESI__ = window.__REACT_ESI__ || {}; window.__REACT_ESI__['${fragmentID}'] = ${encodedProps};document.currentScript.remove();</script>`;

  // Create a stream that first enqueues the script, then the rendered HTML
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      // TextEncoder may not be available in Jest environment; fall back if needed
      const encoder =
        typeof TextEncoder !== "undefined"
          ? new TextEncoder()
          : ({ encode: (s: string) => Buffer.from(s) } as any);
      controller.enqueue(encoder.encode(script));
      controller.close();
    },
  });

  // Note: Full streaming of React server render to Web Stream is non-trivial here without react-dom/server exports
  // For now we return a combined response with script only and advise using Express adapter for streaming.

  return new Response(stream, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
