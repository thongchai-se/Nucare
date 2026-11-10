import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  assertEmailReadyForEnvironment,
  createEmailProvider,
  resetEmailProviderCache,
  resolveEmailProviderKind,
  sendAppEmail,
} from "./index";
import { ConsoleEmailProvider, HttpApiEmailProvider, SmtpEmailProvider } from "./providers";

describe("email provider factory", () => {
  it("defaults to console provider kind", () => {
    const previous = process.env.EMAIL_PROVIDER;
    delete process.env.EMAIL_PROVIDER;
    assert.equal(resolveEmailProviderKind(), "console");
    process.env.EMAIL_PROVIDER = previous;
  });

  it("blocks console email in production unless explicitly allowed", () => {
    const previousNodeEnv = process.env.NODE_ENV;
    const previousProvider = process.env.EMAIL_PROVIDER;
    const previousAllow = process.env.ALLOW_CONSOLE_EMAIL;
    process.env.NODE_ENV = "production";
    process.env.EMAIL_PROVIDER = "console";
    delete process.env.ALLOW_CONSOLE_EMAIL;
    assert.throws(() => assertEmailReadyForEnvironment(), /EMAIL_PROVIDER/);
    process.env.ALLOW_CONSOLE_EMAIL = "true";
    assert.doesNotThrow(() => assertEmailReadyForEnvironment());
    process.env.NODE_ENV = previousNodeEnv;
    process.env.EMAIL_PROVIDER = previousProvider;
    process.env.ALLOW_CONSOLE_EMAIL = previousAllow;
  });

  it("requires SMTP credentials when EMAIL_PROVIDER=smtp in production", () => {
    const previousNodeEnv = process.env.NODE_ENV;
    const previousProvider = process.env.EMAIL_PROVIDER;
    const previousAllow = process.env.ALLOW_CONSOLE_EMAIL;
    const previousUser = process.env.SMTP_USER;
    const previousPass = process.env.SMTP_PASS;
    const previousFrom = process.env.SMTP_FROM;
    process.env.NODE_ENV = "production";
    process.env.EMAIL_PROVIDER = "smtp";
    delete process.env.ALLOW_CONSOLE_EMAIL;
    delete process.env.SMTP_USER;
    delete process.env.SMTP_PASS;
    delete process.env.SMTP_FROM;
    assert.throws(() => assertEmailReadyForEnvironment(), /SMTP_USER/);
    process.env.SMTP_USER = "mail@example.com";
    process.env.SMTP_PASS = "secret";
    process.env.SMTP_FROM = "NUCARE <mail@example.com>";
    assert.doesNotThrow(() => assertEmailReadyForEnvironment());
    process.env.NODE_ENV = previousNodeEnv;
    process.env.EMAIL_PROVIDER = previousProvider;
    process.env.ALLOW_CONSOLE_EMAIL = previousAllow;
    process.env.SMTP_USER = previousUser;
    process.env.SMTP_PASS = previousPass;
    process.env.SMTP_FROM = previousFrom;
  });

  it("creates providers by kind", () => {
    assert.ok(createEmailProvider("console") instanceof ConsoleEmailProvider);
    assert.ok(createEmailProvider("smtp") instanceof SmtpEmailProvider);
    assert.ok(createEmailProvider("http") instanceof HttpApiEmailProvider);
  });

  it("skips invalid recipients without throwing", async () => {
    resetEmailProviderCache();
    process.env.EMAIL_PROVIDER = "console";
    const result = await sendAppEmail({
      to: "not-an-email",
      subject: "ทดสอบ",
      text: "ข้อความ",
    });
    assert.equal(result.ok, false);
    assert.equal(result.skipped, true);
  });

  it("console provider accepts a valid message", async () => {
    resetEmailProviderCache();
    process.env.EMAIL_PROVIDER = "console";
    const result = await sendAppEmail({
      to: "student.test@nucare.local",
      subject: "เตือนทำแบบประเมิน",
      text: "กรุณาเข้าสู่ระบบ NuCare",
    });
    assert.equal(result.ok, true);
    assert.equal(result.provider, "console");
  });

  it("smtp provider skips when credentials missing", async () => {
    const provider = new SmtpEmailProvider();
    const previousUser = process.env.SMTP_USER;
    const previousPass = process.env.SMTP_PASS;
    delete process.env.SMTP_USER;
    delete process.env.SMTP_PASS;
    const result = await provider.send({
      to: "a@b.com",
      subject: "x",
      text: "y",
    });
    assert.equal(result.ok, false);
    assert.equal(result.skipped, true);
    process.env.SMTP_USER = previousUser;
    process.env.SMTP_PASS = previousPass;
  });

  it("http provider skips when EMAIL_HTTP_URL missing", async () => {
    const provider = new HttpApiEmailProvider();
    const previous = process.env.EMAIL_HTTP_URL;
    delete process.env.EMAIL_HTTP_URL;
    const result = await provider.send({
      to: "a@b.com",
      subject: "x",
      text: "y",
    });
    assert.equal(result.ok, false);
    assert.equal(result.skipped, true);
    process.env.EMAIL_HTTP_URL = previous;
  });
});
