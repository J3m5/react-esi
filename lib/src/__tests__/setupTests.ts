// polyfill TextEncoder for Node/Jest environment
// @ts-ignore
if (typeof (global as any).TextEncoder === "undefined") {
  // Node's util exports TextEncoder in recent versions
  try {
    // @ts-ignore
    (global as any).TextEncoder = require("util").TextEncoder;
  } catch (e) {
    // noop
  }
}

// Ensure deterministic secret for signatures used in snapshots
process.env.REACT_ESI_SECRET =
  process.env.REACT_ESI_SECRET ||
  "0000000000000000000000000000000000000000000000000000000000000000";

import "@testing-library/jest-dom";
