import http from "node:http";
import https from "node:https";
import dns from "node:dns/promises";
import net from "node:net";
import { z } from "zod";
import { safeStorage } from "electron";
import type { Store } from "./store";

export function publicAddress(ip: string) {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split(".").map(Number);
    return !(
      a === 0 ||
      a === 10 ||
      a === 127 ||
      a >= 224 ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 198 && (b === 18 || b === 19))
    );
  }
  const v = ip.toLowerCase();
  return (
    net.isIPv6(v) &&
    !v.startsWith("::") &&
    !v.startsWith("fc") &&
    !v.startsWith("fd") &&
    !/^fe[89ab]/.test(v) &&
    !v.startsWith("ff")
  );
}
export async function requestUrl(
  urlText: string,
  options: {
    method?: string;
    headers?: Record<string, string>;
    body?: string;
    allowLocal?: boolean;
  } = {},
) {
  const url = new URL(urlText);
  if (
    !["https:", "http:"].includes(url.protocol) ||
    url.username ||
    url.password
  )
    throw new Error("Only HTTP(S) URLs without credentials are allowed");
  const hostname = url.hostname.replace(/^\[|\]$/g, "");
  const addresses = await dns.lookup(hostname, { all: true });
  if (
    !addresses.length ||
    (!options.allowLocal && addresses.some((a) => !publicAddress(a.address)))
  )
    throw new Error(
      "Private and local network addresses are not available to HTTP tools. Use the browser for a local preview.",
    );
  const target = addresses[0];
  return new Promise<{
    status: number;
    headers: http.IncomingHttpHeaders;
    text: string;
  }>((resolve, reject) => {
    const req = (url.protocol === "https:" ? https : http).request(
      url,
      {
        method: options.method || "GET",
        headers: {
          "User-Agent": "NightCode/0.3",
          Accept: "application/json, text/html, text/plain",
          ...options.headers,
        },
        lookup: ((_host: any, opts: any, callback: any) =>
          opts.all
            ? callback(null, [target])
            : callback(null, target.address, target.family)) as any,
      },
      (res) => {
        let size = 0;
        const chunks: Buffer[] = [];
        res.on("data", (chunk) => {
          size += chunk.length;
          if (size > 2 * 1024 * 1024) {
            req.destroy(new Error("Response exceeds the 2 MB limit"));
            return;
          }
          chunks.push(chunk);
        });
        res.on("error", reject);
        res.on("end", () =>
          resolve({
            status: res.statusCode || 0,
            headers: res.headers,
            text: Buffer.concat(chunks).toString("utf8"),
          }),
        );
      },
    );
    const timer = setTimeout(
      () => req.destroy(new Error("HTTP request timed out after 20 seconds")),
      20000,
    );
    req.once("close", () => clearTimeout(timer));
    req.once("error", reject);
    if (options.body) req.write(options.body);
    req.end();
  });
}
type Secret = {
  id: string;
  name: string;
  origin: string;
  header: string;
  prefix: string;
  cipher: string;
};
export class SecretVault {
  constructor(private store: Store) {}
  private all() {
    return this.store.get<Secret[]>("integrationSecrets", []);
  }
  list() {
    return this.all().map(({ cipher, ...s }) => s);
  }
  save(input: unknown) {
    const p = z
      .object({
        name: z.string().regex(/^[a-z][a-z0-9_-]{0,63}$/),
        origin: z.string().url(),
        header: z
          .enum(["Authorization", "X-API-Key", "api-key"])
          .default("Authorization"),
        prefix: z.enum(["Bearer ", "", "Basic "]).default("Bearer "),
        value: z.string().min(1).max(16000),
      })
      .parse(input);
    const origin = new URL(p.origin);
    if (origin.protocol !== "https:")
      throw new Error("Secret bindings require HTTPS");
    if (!safeStorage.isEncryptionAvailable())
      throw new Error("Encrypted storage is unavailable on this device");
    const item = {
      id: p.name,
      name: p.name,
      origin: origin.origin,
      header: p.header,
      prefix: p.prefix,
      cipher: safeStorage.encryptString(p.value).toString("base64"),
    };
    this.store.set("integrationSecrets", [
      ...this.all().filter((s) => s.id !== item.id),
      item,
    ]);
    return this.list();
  }
  remove(id: string) {
    this.store.set(
      "integrationSecrets",
      this.all().filter((s) => s.id !== id),
    );
  }
  headers(id: string, url: string) {
    const s = this.all().find((s) => s.id === id);
    if (!s) throw new Error("Save this secret in Connections first");
    if (new URL(url).origin !== s.origin)
      throw new Error("This secret is bound to a different origin");
    const value = safeStorage.decryptString(Buffer.from(s.cipher, "base64"));
    return { [s.header]: s.prefix + value };
  }
  redact(text: string) {
    for (const s of this.all()) {
      let value = "";
      try {
        value = safeStorage.decryptString(Buffer.from(s.cipher, "base64"));
      } catch {
        continue;
      }
      for (const variant of [
        value,
        encodeURIComponent(value),
        Buffer.from(value).toString("base64"),
      ])
        if (variant) text = text.split(variant).join("[redacted]");
    }
    return text;
  }
  async request(input: unknown) {
    const p = z
      .object({
        url: z.string().url().max(4000),
        method: z
          .enum(["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD"])
          .default("GET"),
        body: z.string().max(200000).optional(),
        secretId: z.string().optional(),
        headers: z.record(z.string().max(2000)).default({}),
      })
      .parse(input);
    for (const h of Object.keys(p.headers))
      if (
        !["accept", "content-type", "if-none-match"].includes(h.toLowerCase())
      )
        throw new Error(
          "Use an encrypted secret binding for authentication headers",
        );
    const headers = {
      ...p.headers,
      ...(p.secretId ? this.headers(p.secretId, p.url) : {}),
    };
    const result = await requestUrl(p.url, { ...p, headers });
    return {
      url: p.url,
      status: result.status,
      contentType: result.headers["content-type"],
      text: this.redact(result.text).slice(0, 60000),
      truncated: result.text.length > 60000,
      redirect: result.headers.location
        ? new URL(result.headers.location, p.url).toString()
        : undefined,
    };
  }
}
