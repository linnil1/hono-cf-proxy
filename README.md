# Write your own API proxy by Hono + Cloudflare

## TL;DR
I came up with a idea that using Cloudflare Worker as a powerful proxy for API management. I created some middlewares using the Hono Framework, combined with Cloudflare's KV, DO, and D1 services. These scripts serve as a demonstration of how Hono and Cloudflare can be used for API management.

Try it locally:
Proxy: `npm run dev`
Backend: `uvicorn backend:app --reload --port 5000`
Host: `localhost:8787`

Try the demo: (The target is [httpbin](https://httpbin.org/))
Host: `https://hono-cf-proxy.linnil1.me`


## Introduction

In my recent exploration of API management solutions, I have try popular Software as a Service (SaaS) like Apigee and KONG. These services serves as proxies, efficiently "managing" APIs by handling common authorization/security tasks such as login processes, permissions, and rate limiting, allowing developers to concentrate on refining their business models.

Fortunately, in recent year, Cloudflare has not only released Key-Value (KV) services but has also introduced offerings like Durable Object (DO), R3 (S3 object), and D1 (SQL Database), providing essential serverless services that tightly integrate with serverless Workers. These Workers are capable of executing custom code, making them easy enough to handle a wide range of tasks.

Motivated by this, I explored the potential to use Cloudflare to build an API manager. Cloudflare Workers allow users to run any JavaScript code, including functions to "Manage" APIs, while temporary data can be stored in KV, DO, or more structurally in D1.  With cost-effectiveness especially for projects with low/modest connection, Cloudflare's professional tier, featuring generous free limits, is available for just $5.

For eaiser to handle request and response, I discovered the efficient "Hono" framework, a lightweight and native JavaScript framework with native support for Cloudflare Workers. For local development, Cloudflare provides the powerful open-source simulator Miniflare, seamlessly integrating DO, D1, and KV. This allows for easy developing/testing (`wrangler dev`) and deployment of the exact same code for production. With Hono, all we need is to write our own [Middleware](https://hono.dev/guides/middleware) .

Surprisingly, several ready-to-use middleware solutions already exist:

- [Third-Party Middleware](https://hono.dev/middleware/third-party)
- [Hono Middleware Packages](https://github.com/honojs/middleware/tree/main/packages)
- [Hono Middleware Repository](https://github.com/honojs/hono/tree/main/src/middleware)

I implemented some examples of useful middleware, covering basic/token authentication, OAuth2, request/response rewriting, rate limiting, quota limiting, caching, websocket and user permissions for access. Some leverage existing middleware, while others are crafted to integrate with KV, DO, and D1. The examples are shown in [wiki](https://github.com/linnil1/hono-cf-proxy/wiki) in this repo.
