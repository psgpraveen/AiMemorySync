import assert from "assert";
import { NextRequest } from "next/server";
import { isConnectionSecure, getSessionCookieOptions } from "../src/lib/auth/cookies";

function runTests() {
  console.log("=== Testing Cookie Security Protocol Resolution ===");

  const originalEnv = { ...process.env };

  try {
    // 1. Explicit override via COOKIE_SECURE
    delete process.env.NEXT_PUBLIC_APP_URL;
    delete process.env.APP_URL;

    process.env.COOKIE_SECURE = "true";
    assert.strictEqual(isConnectionSecure(null), true, "COOKIE_SECURE=true must force secure=true");

    process.env.COOKIE_SECURE = "false";
    assert.strictEqual(isConnectionSecure(null), false, "COOKIE_SECURE=false must force secure=false");

    delete process.env.COOKIE_SECURE;

    // 2. HTTP Request (e.g. AWS EC2 direct IP: http://13.206.58.90:3005) in production
    (process.env as Record<string, string | undefined>).NODE_ENV = "production";
    const httpReq = new NextRequest("http://13.206.58.90:3005/api/auth/login", {
      method: "POST",
    });

    assert.strictEqual(
      isConnectionSecure(httpReq),
      false,
      "Direct HTTP IP access in production must return secure=false so browsers accept the cookie"
    );

    const httpOptions = getSessionCookieOptions(httpReq);
    assert.strictEqual(httpOptions.secure, false, "Cookie options must have secure: false for HTTP");
    assert.strictEqual(httpOptions.httpOnly, true, "Cookie options must retain httpOnly: true");
    assert.strictEqual(httpOptions.sameSite, "lax", "Cookie options must retain sameSite: lax");

    // 3. HTTPS Request (direct TLS)
    const httpsReq = new NextRequest("https://app.aimemorysync.com/api/auth/login", {
      method: "POST",
    });
    assert.strictEqual(
      isConnectionSecure(httpsReq),
      true,
      "Direct HTTPS access must return secure=true"
    );
    const httpsOptions = getSessionCookieOptions(httpsReq);
    assert.strictEqual(httpsOptions.secure, true, "Cookie options must have secure: true for HTTPS");

    // 4. Reverse Proxy / ALB / Cloudflare forwarding headers (x-forwarded-proto)
    const proxiedHttpsReq = new NextRequest("http://127.0.0.1:3005/api/auth/login", {
      method: "POST",
      headers: {
        "x-forwarded-proto": "https",
      },
    });
    assert.strictEqual(
      isConnectionSecure(proxiedHttpsReq),
      true,
      "x-forwarded-proto: https must return secure=true"
    );

    const proxiedHttpReq = new NextRequest("http://127.0.0.1:3005/api/auth/login", {
      method: "POST",
      headers: {
        "x-forwarded-proto": "http",
      },
    });
    assert.strictEqual(
      isConnectionSecure(proxiedHttpReq),
      false,
      "x-forwarded-proto: http must return secure=false"
    );

    // 5. Cloudflare visitor header (cf-visitor)
    const cfReq = new NextRequest("http://127.0.0.1:3005/api/auth/login", {
      method: "POST",
      headers: {
        "cf-visitor": JSON.stringify({ scheme: "https" }),
      },
    });
    assert.strictEqual(
      isConnectionSecure(cfReq),
      true,
      "cf-visitor scheme https must return secure=true"
    );

    // 6. Overload signatures: getSessionCookieOptions(maxAge) vs getSessionCookieOptions(req, maxAge)
    const customMaxAge = 86400;
    const opt1 = getSessionCookieOptions(customMaxAge);
    assert.strictEqual(opt1.maxAge, customMaxAge, "Single number argument should set maxAge");

    const opt2 = getSessionCookieOptions(httpsReq, customMaxAge);
    assert.strictEqual(opt2.maxAge, customMaxAge, "request + number argument should set maxAge");
    assert.strictEqual(opt2.secure, true, "request + number argument should evaluate security");

    const opt3 = getSessionCookieOptions();
    assert.strictEqual(opt3.maxAge, 30 * 24 * 60 * 60, "Default maxAge should be 30 days");

    console.log("All cookie security tests PASSED cleanly!");
  } finally {
    process.env = originalEnv;
  }
}

runTests();
