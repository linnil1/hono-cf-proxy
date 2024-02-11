import type { Handler, MiddlewareHandler } from "hono"

/**
 * Proxy the request to a specific URL.
 *
 * @param {string} [proxy_url=""] - The URL to proxy the request to.
 * @returns {Handler} The handler function for Hono.
 */
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
            rep.body,
            rep.status,
            Object.fromEntries(rep.headers),
        )
    }
}

/**
 * Save information from the incoming request in variables
 * to allow for further middleware processing.
 *
 * @returns {MiddlewareHandler} Hono middleware handler.
 */
export function extractReqVar(): MiddlewareHandler {
    return async (c, next) => {
        c.set("method", c.req.method)
        c.set("headers", Object.fromEntries(c.req.raw.headers))
        c.set("queries", c.req.query())
        // text() will be null if method=GET
        c.set("body", await c.req.raw.text())
        await next()
    }
}

/**
 * Save information from the incoming request in Hono variables
 * to allow for further middleware processing.
 * After processing, construct the response from Hono variables.
 *
 * @returns {MiddlewareHandler} Hono middleware handler.
 */
export function handleReqResVar(): MiddlewareHandler {
    return async (c, next) => {
        c.set("method", c.req.method)
        c.set("headers", Object.fromEntries(c.req.raw.headers))
        c.set("queries", c.req.query())
        c.set("body", await c.req.raw.text())
        await next()
        c.res = new Response(c.get("resp_body"), {
            status: c.get("status"),
            headers: c.res.headers,
        })
    }
}

/**
 * Use Hono variables for request options
 *
 * @param {string} [proxy_url=""] - The URL to proxy the request to.
 * @returns {Handler} The handler function for Hono.
 */
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

/**
 * Use Hono variables for request and response
 *
 * @param {string} [proxy_url=""] - The URL to proxy the request to.
 * @returns {Handler} The handler function for Hono.
 */
export function variableProxy(proxy_url: string = ""): Handler {
    return async (c) => {
        let path = proxy_url + c.req.path
        if (c.get("queries"))
            path = path + "?" + new URLSearchParams(c.get("queries"))
        console.log(path)
        const rep = await fetch(path, {
            method: c.get("method"),
            headers: c.get("headers"),
            body: c.get("method") == "GET" ? null : c.get("body"),
        })
        console.log(rep)
        c.set("resp_body", rep.body)
        c.set("status", rep.status)
        return c.newResponse(
            c.get("resp_body"),
            rep.status,
            Object.fromEntries(rep.headers),
        )
    }
}
