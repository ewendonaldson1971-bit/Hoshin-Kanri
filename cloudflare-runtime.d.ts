/** Minimal runtime declarations used by the Cloudflare-compatible build. */
declare interface Fetcher {
  fetch(input: Request | string | URL, init?: RequestInit): Promise<Response>;
}

declare interface D1Database {
  prepare(query: string): unknown;
  batch<T = unknown>(statements: unknown[]): Promise<T[]>;
  exec(query: string): Promise<unknown>;
  dump(): Promise<ArrayBuffer>;
}

declare module "cloudflare:workers" {
  export const env: {
    DB?: D1Database;
    SOP_ASSETS?: {
      get(key: string): Promise<{ body: ReadableStream; httpMetadata?: { contentType?: string }; writeHttpMetadata(headers: Headers): void } | null>;
      put(key: string, value: ArrayBuffer | ReadableStream, options?: { httpMetadata?: { contentType?: string }; customMetadata?: Record<string, string> }): Promise<unknown>;
      delete(key: string): Promise<void>;
    };
    [binding: string]: unknown;
  };
}
