import type { Handler, MiddlewareHandler } from "hono"

// Proxy the request to specific URL
export function basicProxy(proxy_url: string = ""): Handler {
    return async (c) => {
        // remove prefix
        // prefix = /app1/*, path = /app1/a/b
        // => suffix_path = /a/b
        let suffix_path = c.req.path
        suffix_path =
            "/" +
            suffix_path.replace(
                new RegExp(`^${c.req.routePath.replace("*", "")}`),
                "",
            )
        let path = proxy_url ? proxy_url + suffix_path : c.req.url
        console.log(path)
        // add params to URL
        if (c.req.query())
            path = path + "?" + new URLSearchParams(c.req.query())
        // request
        const rep = await fetch(path, {
            method: c.req.method,
            headers: c.req.raw.headers,
            body: c.req.raw.body,
        })
        // return rep
        // or Use Hono provided Response class
        return c.newResponse(
            await rep.text(),
            rep.status,
            Object.fromEntries(rep.headers),
        )
    }
}

// Save information from the incoming request in variables
// Allow for further middleware processing
export function extractReqVar(): MiddlewareHandler {
    return async (c, next) => {
        c.set("method", c.req.method)
        c.set("headers", Object.fromEntries(c.req.raw.headers))
        c.set("queries", c.req.query())
        // text() will be null if method=GET
        c.set("body", await c.req.raw.text())
        await next()
        c.res = new Response(c.get("resp"), {
            status: c.get("status"),
            headers: c.res.headers,
        })
    }
}

// Save information from the incoming request in variables
// Allow for further middleware processing
// After that, construct the response from variable
export function handleReqResVar(): MiddlewareHandler {
    return async (c, next) => {
        c.set("method", c.req.method)
        c.set("headers", Object.fromEntries(c.req.raw.headers))
        c.set("queries", c.req.query())
        // text() will be null if method=GET
        c.set("body", await c.req.raw.text())
        await next()
        c.res = new Response(c.get("resp"), {
            status: c.get("status"),
            headers: c.res.headers,
        })
    }
}

// Use Hono variables for request options
export function proxyReqVar(proxy_url: string = ""): Handler {
    return async (c) => {
        let path = proxy_url + c.req.path
        if (c.get("queries"))
            path = path + "?" + new URLSearchParams(c.get("queries"))
        const rep = await fetch(path, {
            method: c.get("method"),
            headers: c.get("headers"),
            body: c.get("method") == "GET" ? null : c.get("body"),
        })
        return rep
    }
}

// Use Hono variables for request and response
export function variableProxy(proxy_url: string = ""): Handler {
    return async (c) => {
        let path = proxy_url + c.req.path
        if (c.get("queries"))
            path = path + "?" + new URLSearchParams(c.get("queries"))
        const rep = await fetch(path, {
            method: c.get("method"),
            headers: c.get("headers"),
            body: c.get("method") == "GET" ? null : c.get("body"),
        })
        c.set("resp", await rep.text())
        c.set("status", rep.status)
        return c.newResponse(
            c.get("resp"),
            rep.status,
            Object.fromEntries(c.res.headers),
        )
    }
}
