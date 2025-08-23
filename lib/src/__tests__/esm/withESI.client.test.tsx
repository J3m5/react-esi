import { render, screen } from "@testing-library/react";
import { ESIClientWrapper } from "../../esm/withESI.client.js";

function TestComponent({ message }: { message?: string }) {
  return <div data-testid="msg">{message}</div>;
}

describe("ESIClientWrapper", () => {
  beforeEach(() => {
    // @ts-ignore
    delete (window as any).__REACT_ESI__;
  });

  test("renders with initial props from window.__REACT_ESI__", () => {
    (window as any).__REACT_ESI__ = {
      testFrag: { message: "hello from server" },
    };

    render(
      <ESIClientWrapper
        WrappedComponent={TestComponent}
        fragmentID="testFrag"
      />
    );

    expect(screen.getByTestId("msg").textContent).toBe("hello from server");
  });

  test("calls getInitialProps when present", async () => {
    const Wrapped: any = TestComponent;
    Wrapped.getInitialProps = ({ props }: any) =>
      Promise.resolve({ message: "from getInitialProps" });

    render(<ESIClientWrapper WrappedComponent={Wrapped} fragmentID="nope" />);

    // wait for async effect
    const el = await screen.findByTestId("msg");
    expect(el.textContent).toBe("from getInitialProps");
  });
});
