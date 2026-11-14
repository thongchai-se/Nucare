import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isNeonDatabaseHost,
  normalizeDatabaseUrl,
  toNeonDirectDatabaseUrl,
  toNeonDirectHost,
  toNeonPoolerHost,
} from "./database-url";

const USERINFO = "neondb_owner:secret";
const DB = "neondb";
const DIRECT_HOST = "ep-winter-bonus-a1vgk8ws.ap-southeast-1.aws.neon.tech";
const POOLER_HOST = "ep-winter-bonus-a1vgk8ws-pooler.ap-southeast-1.aws.neon.tech";

describe("database-url Neon helpers", () => {
  it("detects Neon hosts", () => {
    assert.equal(isNeonDatabaseHost(DIRECT_HOST), true);
    assert.equal(isNeonDatabaseHost(POOLER_HOST), true);
    assert.equal(isNeonDatabaseHost("localhost"), false);
  });

  it("converts pooler <-> direct hostnames", () => {
    assert.equal(toNeonDirectHost(POOLER_HOST), DIRECT_HOST);
    assert.equal(toNeonDirectHost(DIRECT_HOST), DIRECT_HOST);
    assert.equal(toNeonPoolerHost(DIRECT_HOST), POOLER_HOST);
    assert.equal(toNeonPoolerHost(POOLER_HOST), POOLER_HOST);
  });

  it("long-running runtime strips pooler and channel_binding", () => {
    const input = `postgresql://${USERINFO}@${POOLER_HOST}/${DB}?sslmode=require&channel_binding=require`;
    const normalized = normalizeDatabaseUrl(input, { runtime: "long-running" });
    const url = new URL(normalized);

    assert.equal(url.hostname, DIRECT_HOST);
    assert.equal(url.searchParams.get("sslmode"), "require");
    assert.equal(url.searchParams.get("connect_timeout"), "15");
    assert.equal(url.searchParams.has("channel_binding"), false);
    assert.equal(url.searchParams.has("pgbouncer"), false);
  });

  it("serverless runtime forces pooler + pgbouncer", () => {
    const input = `postgresql://${USERINFO}@${DIRECT_HOST}/${DB}?sslmode=require`;
    const normalized = normalizeDatabaseUrl(input, { runtime: "serverless" });
    const url = new URL(normalized);

    assert.equal(url.hostname, POOLER_HOST);
    assert.equal(url.searchParams.get("pgbouncer"), "true");
    assert.equal(url.searchParams.get("connection_limit"), "1");
    assert.equal(url.searchParams.get("sslmode"), "require");
  });

  it("toNeonDirectDatabaseUrl is safe for migrations", () => {
    const input = `postgresql://${USERINFO}@${POOLER_HOST}/${DB}?sslmode=require&pgbouncer=true&channel_binding=require`;
    const direct = toNeonDirectDatabaseUrl(input);
    const url = new URL(direct);

    assert.equal(url.hostname, DIRECT_HOST);
    assert.equal(url.searchParams.has("pgbouncer"), false);
    assert.equal(url.searchParams.has("channel_binding"), false);
    assert.equal(url.searchParams.get("sslmode"), "require");
  });

  it("leaves non-Neon URLs unchanged", () => {
    const local = "postgresql://nucare:nucare_password@localhost:5432/nucare?schema=public";
    assert.equal(normalizeDatabaseUrl(local, { runtime: "long-running" }), local);
  });
});
