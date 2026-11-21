import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { scrollOverflowContainerToBottom } from "./scroll-container";

describe("scrollOverflowContainerToBottom", () => {
  it("ไม่โยนเมื่อไม่มี node", () => {
    assert.doesNotThrow(() => scrollOverflowContainerToBottom(null));
  });

  it("ไม่เลื่อน document root แม้ overflow เป็น scroll", () => {
    const bodyStyle: Record<string, string> = {
      overflow: "auto",
      overflowY: "auto",
    };
    const htmlStyle: Record<string, string> = {
      overflow: "auto",
      overflowY: "auto",
    };

    const body = {
      style: bodyStyle,
      scrollHeight: 4000,
      clientHeight: 800,
      scrollTop: 100,
      parentElement: null as HTMLElement | null,
    };
    const html = {
      style: htmlStyle,
      scrollHeight: 4000,
      clientHeight: 800,
      scrollTop: 100,
      parentElement: null as HTMLElement | null,
    };
    body.parentElement = html as unknown as HTMLElement;

    const child = {
      parentElement: body as unknown as HTMLElement,
    };

    (globalThis as typeof globalThis & { window: Window }).window = {
      getComputedStyle: (el: { style: Record<string, string> }) =>
        ({
          overflow: el.style.overflow || "",
          overflowY: el.style.overflowY || el.style.overflow || "",
        }) as CSSStyleDeclaration,
    } as Window;

    (globalThis as typeof globalThis & { document: Document }).document = {
      body,
      documentElement: html,
    } as unknown as Document;

    scrollOverflowContainerToBottom(child as unknown as HTMLElement);
    assert.equal(body.scrollTop, 100);
    assert.equal(html.scrollTop, 100);
  });
});
