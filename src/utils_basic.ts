import type { Handler, MiddlewareHandler } from "hono"

// proxy the request to specific URL
export function proxy_simple(proxy_path: string = ""): Handler {
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
        let path = proxy_path ? proxy_path + suffix_path : c.req.url
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

// Put request's method/header/queries/body to var
// This allow other middleware to modify
export function request_to_var(): MiddlewareHandler {
    return async (c, next) => {
        c.set("method", c.req.method)
        c.set("headers", Object.fromEntries(c.req.raw.headers))
        c.set("queries", c.req.query())
        // text() will be null if method=GET
        c.set("body", await c.req.raw.text())
        await next()
    }
}

// Call the target by hono variable
export function proxy_with_var(proxy_path: string = ""): Handler {
    return async (c) => {
        let path = proxy_path + c.req.path
        if (c.get("queries"))
            path = path + "?" + new URLSearchParams(c.get("queries"))
        let rep = null
        rep = await fetch(path, {
            method: c.get("method"),
            headers: c.get("headers"),
            body: c.get("method") == "GET" ? null : c.get("body"),
        })
        // return rep
        return c.newResponse(
            await rep.text(),
            JSON.stringify(c.get("data")),
            c.res.status,
            Object.fromEntries(c.res.headers),
        )
    }
}
