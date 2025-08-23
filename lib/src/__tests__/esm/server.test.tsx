import {
  serveFragmentExpress,
  createIncludeElement,
} from "../../esm/server.js";
import React from "react";

// Simple resolver that returns a component
const resolver = (id: string) => (props: any) =>
  React.createElement("div", null, "ok");

describe("serveFragmentExpress", () => {
  test("returns 400 for bad signature", async () => {
    const req = { url: "/_fragment?fragment=foo&props={}" };
    const res: any = {
      status(code: number) {
        this._status = code;
        return this;
      },
      send(body: any) {
        this._body = body;
      },
    };

    await serveFragmentExpress(req, res, resolver as any);

    expect(res._status).toBe(400);
    expect(res._body).toBe("Bad signature");
  });
});
