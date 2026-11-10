import assert from "node:assert/strict";
import { afterEach, before, describe, it } from "node:test";

type StyleBag = Record<string, string>;

function installDomStub() {
  const bodyStyle: StyleBag = {
    overflow: "",
    paddingRight: "",
    position: "",
    top: "",
    left: "",
    right: "",
    width: "",
  };
  const htmlStyle: StyleBag = { overflow: "" };

  const windowStub = {
    scrollY: 120,
    innerWidth: 1024,
    scrollTo(x: number, y: number) {
      windowStub.scrollY = y;
      void x;
    },
  };

  (globalThis as typeof globalThis & { window: typeof windowStub }).window = windowStub;
  (globalThis as typeof globalThis & { document: Document }).document = {
    body: { style: bodyStyle },
    documentElement: { style: htmlStyle, clientWidth: 1008 },
  } as unknown as Document;
}

describe("body scroll lock", () => {
  let acquireBodyScrollLock: typeof import("./body-scroll-lock").acquireBodyScrollLock;
  let getBodyScrollLockCountForTests: typeof import("./body-scroll-lock").getBodyScrollLockCountForTests;
  let resetBodyScrollLockForTests: typeof import("./body-scroll-lock").resetBodyScrollLockForTests;

  before(async () => {
    installDomStub();
    ({
      acquireBodyScrollLock,
      getBodyScrollLockCountForTests,
      resetBodyScrollLockForTests,
    } = await import("./body-scroll-lock"));
  });

  afterEach(() => {
    resetBodyScrollLockForTests();
    installDomStub();
  });

  it("BSL-01 ล็อกครั้งแรกตั้ง position fixed และนับจำนวน", () => {
    assert.equal(getBodyScrollLockCountForTests(), 0);
    const release = acquireBodyScrollLock();
    assert.equal(getBodyScrollLockCountForTests(), 1);
    assert.equal(document.body.style.position, "fixed");
    assert.equal(document.body.style.overflow, "hidden");
    assert.equal(document.body.style.top, "-120px");
    assert.equal(document.body.style.paddingRight, "");
    assert.equal(document.documentElement.style.overflow, "hidden");
    release();
    assert.equal(getBodyScrollLockCountForTests(), 0);
    assert.equal(document.body.style.position, "");
    assert.equal(document.body.style.overflow, "");
    assert.equal(window.scrollY, 120);
  });

  it("BSL-04 ไม่ใส่ paddingRight ทับ scrollbar-gutter", () => {
    document.body.style.paddingRight = "";
    const release = acquireBodyScrollLock();
    assert.equal(document.body.style.paddingRight, "");
    release();
  });

  it("BSL-02 ล็อกซ้อนกันปลดเมื่อครบทุกชั้น", () => {
    const first = acquireBodyScrollLock();
    const second = acquireBodyScrollLock();
    assert.equal(getBodyScrollLockCountForTests(), 2);
    first();
    assert.equal(getBodyScrollLockCountForTests(), 1);
    assert.equal(document.body.style.position, "fixed");
    second();
    assert.equal(getBodyScrollLockCountForTests(), 0);
    assert.equal(document.body.style.position, "");
  });

  it("BSL-03 เรียกปลดซ้ำไม่ทำให้ล็อกติดลบ", () => {
    const release = acquireBodyScrollLock();
    release();
    release();
    assert.equal(getBodyScrollLockCountForTests(), 0);
    assert.equal(document.body.style.position, "");
  });
});
