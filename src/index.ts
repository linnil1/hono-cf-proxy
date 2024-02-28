import { Hono } from "hono"
import { HTTPException } from "hono/http-exception"

import { basicProxy } from "./utils_basic"

export { RateLimiter } from "./rate_limiter"
export { QuotaLimiter } from "./quota_limiter"

type Bindings = {
    RATE: DurableObjectNamespace
    QUOTA: DurableObjectNamespace
    DATA: KVNamespace
    DB: D1Database
    OAUTH_GITHUB_CLIENT_ID: string // set in .dev.vars
    OAUTH_GITHUB_CLIENT_SECRET: string // set in .dev.vars
    JWT_SECRET: string // set in .dev.vars
}
type Variables = {
    method: string
    headers: Record<string, string>
    queries: Record<string, string>
    path: string
    body?: string
    status?: number
    resp_body?: string
    resp_headers?: Record<string, string>
    ws_server?: WebSocket
    ws_client?: WebSocket
}

const app = new Hono<{
    Bindings: Bindings
    Variables: Variables
}>()

// const target_url = "http://localhost:5000"  // debug
const target_url = "https://httpbin.org"
// const target_ws_url = target_url + "/websocket"   // debug
const target_ws_url = "https://echo.websocket.org"
// The socketio server is from https://socket.io/demos/chat/
const target_sio_url = "https://socketio-chat-h9jt.herokuapp.com"
// const target_sio_url = target_url + "/socketio"  // debug
// const target_grpc_url = "http://localhost:5001"  // not work
// const target_grpc_url = "grpcbin.test.k6.io"

// Proxy to target
// Most of HTTP request will work
// e.g. curl {host}/basic/get
app.all("/basic/*", basicProxy(target_url))

// Modify the response data(header, status code, data)
app.use("/rewrite_res/*", async (c, next) => {
    await next()
    // If await c.req.xx() is called or status_code is changed
    // A new response should overwrite the c.res object
    const data = JSON.parse(await c.res.text())
    data["response_headers"] = Object.fromEntries(c.res.headers)
    c.res = new Response(JSON.stringify(data), {
        status: 400,
        headers: c.res.headers,
    })
    // the header in Hono is mutable
    c.header("Server", "") // = delete it
    c.header("in_after_rep", "add_in_after_rep_value")
})
app.all("/rewrite_res/*", basicProxy(target_url))

// Rewrite the request (header, method, query, data)
app.use("/rewrite_req/*", async (c, next) => {
    let url_obj = new URL(c.req.url)
    let path = url_obj.pathname
    path = "/post"
    let queries = c.req.query()
    queries["add_query"] = "add_query_value"
    let headers = Object.fromEntries(c.req.raw.headers)
    headers["add_header"] = "add_header_value"
    // let data = JSON.parse(await c.req.text())
    let data = { data: "data1" }

    const req = new Request(
        url_obj.origin + path + "?" + new URLSearchParams(queries),
        {
            // method: c.req.method,
            method: "POST",
            headers: headers,
            body: JSON.stringify(data),
        },
    )
    c.req.raw = req
    c.req.path = path
    await next()
})
app.use("/rewrite_req/*", basicProxy(target_url))

// Rewrite the request and response
import { handleReqResVar, variableProxy } from "./utils_basic"
app.use("/rewrite_req_res/*", handleReqResVar())
app.use("/rewrite_req_res/*", async (c, next) => {
    let querys = c.get("queries")
    querys["query"] = "add_query_value"
    c.set("queries", querys)
    c.set("path", c.get("path").replace("/rewrite_req_res", ""))
    await next()
    const body = c.get("resp_body")
    body["add_resp"] = true
    c.set("status", 201)
    c.set("resp_body", body)
})
app.all("/rewrite_req_res/*", variableProxy(target_url))

// Image: the same as '{host}/basic/image/png'
app.use("/get_image/*", async (c, next) => {
    c.req.path = "/image/png"
    await next()
})
app.get("/get_image/*", basicProxy(target_url))

// Fetch another website
app.use("/fetch_another/*", handleReqResVar())
app.use("/fetch_another/*", async (c, next) => {
    c.set("path", c.get("path").replace("/fetch_another", ""))
    await next()
    const rep = await fetch(target_url + "/get?another_query=true")
    const data = c.get("resp_body")
    data["fetch_another"] = await rep.json()
    c.set("resp_body", data)
})
app.all("/fetch_another/*", variableProxy(target_url))

// Authorization with hard-coded token
// https://github.com/honojs/hono/blob/main/src/middleware/bearer-auth/index.ts
import { bearerAuth } from "hono/bearer-auth"
app.get("/auth_original/init", async (c) => c.json({ token: "token1" }))
app.use("/auth_original/*", bearerAuth({ token: "token1" }))
app.all("/auth_original/*", basicProxy(target_url))

// Authorization by Basic auth (user/password)
// https://github.com/honojs/hono/blob/main/src/middleware/basic-auth/index.ts
import { basicAuth } from "hono/basic-auth"
app.get("/auth_original_basic/init", async (c) =>
    c.json({ username: "linnil1", password: "linnil1" }),
)
app.use(
    "/auth_original_basic/*",
    basicAuth({ username: "linnil1", password: "linnil1" }),
)
app.all("/auth_original_basic/*", basicProxy(target_url))

// Authorization by JWT
// https://github.com/honojs/hono/blob/main/src/middleware/jwt/index.ts
import { jwt, sign } from "hono/jwt"
import { extractUserFromJWT, returnUserInfo } from "./utils_auth"
app.get("/auth_jwt/init", async (c) => {
    // you can retrieve from KV
    const data = {
        user_id: "linnil1",
        username: "linnil1",
        exp: Math.floor(Date.now() / 1000) + 60 * 5, // 5mins
    }
    return c.json({ token: await sign(data, c.env.JWT_SECRET, "HS256") })
})
app.use(
    "/auth_jwt/*",
    async (c, next) => await jwt({ secret: c.env.JWT_SECRET })(c, next),
)
app.use("/auth_jwt/*", extractUserFromJWT())
app.all("/auth_jwt/*", returnUserInfo())

// Authorization by dynamic KV with separated user and token
// This implementation allows multiple tokens for a user
import { validateTokenByKv, generateTokenId } from "./utils_auth"
app.get("/auth_kv/init", async (c) => {
    const group = c.req.query("group")
    if (!group) {
        throw new HTTPException(400, {
            message: "?group=group1 or ?group=group2 is required",
        })
    }
    // Create user object and saved in KV
    const user_obj = {
        username: `linnil1-${group}`,
        user_id: `linnil1-${group}`,
        groups: group == "group1" ? ["group1", "group2"] : ["group2"],
    }
    await c.env.DATA.put(`user-${user_obj.user_id}`, JSON.stringify(user_obj))
    // Create token object and saved in KV
    const token_obj = {
        token_id: await generateTokenId(c),
        user_id: user_obj.user_id,
    }
    await c.env.DATA.put(
        `token-${token_obj.token_id}`,
        JSON.stringify(token_obj),
        { expirationTtl: 3600 },
    )
    return c.json({ token: token_obj.token_id })
})
app.use("/auth_kv/*", validateTokenByKv())
app.all("/auth_kv/*", returnUserInfo())

// Group permission
// And allow group1 to access, i.e. linnil1 can access but linnil2 cannot
app.get("/auth_group_kv/init", async (c) => {
    return c.redirect(`/auth_kv/init?group=${c.req.query("group") || ""}`)
})
import { groupPermission } from "./utils_auth"
app.use("/auth_group_kv/*", validateTokenByKv())
app.use("/auth_group_kv/*", groupPermission("group1"))
app.all("/auth_group_kv/*", returnUserInfo())

// All table are save in D1(SQL)
import { validateTokenBySql } from "./utils_auth"
app.get("/auth_group_sql/init", async (c) => {
    const group_name = c.req.query("group")
    if (!group_name)
        throw new HTTPException(400, { message: "?group=group1 is required" })
    while (true) {
        const token = crypto.randomUUID()
        try {
            const result = await c.env.DB.prepare(
                "INSERT INTO tokens (token_id, user_id, expires_at) VALUES (?, ?, ?)",
            )
                // expire at 60 mins
                .bind(
                    token,
                    group_name == "group1" ? 1 : 2,
                    new Date(Date.now() + 60 * 60 * 1000).toISOString(),
                )
                .run()
            return c.json({ token })
        } catch (e: any) {
            console.log(e)
        }
    }
})
app.use("/auth_group_sql/*", validateTokenBySql())
app.use("/auth_group_sql/*", groupPermission("group1"))
app.all("/auth_group_sql/*", returnUserInfo())

// Use Github to login
// https://github.com/honojs/middleware/tree/main/packages/oauth-providers
import { githubAuth } from "@hono/oauth-providers/github"
app.use(
    "/auth_github",
    async (c, next) =>
        await githubAuth({
            client_id: c.env.OAUTH_GITHUB_CLIENT_ID,
            client_secret: c.env.OAUTH_GITHUB_CLIENT_SECRET,
        })(c, next),
)
app.get("/auth_github", async (c) => {
    // Retrieve github user info
    const github_user = c.get("user-github")
    if (!github_user) throw new HTTPException(401, { message: "Unauthorized" })
    console.log(github_user)
    // Save GitHub user information into KV
    // Use GitHub ID as user ID
    await c.env.DATA.put(
        "user-github-" + github_user.id,
        JSON.stringify(github_user),
    )

    // Issue token
    const token_obj = {
        token_id: await generateTokenId(c),
        user_id: "github-" + github_user.id,
        create_at: new Date().toISOString(),
    }
    await c.env.DATA.put(
        "token-" + token_obj.token_id,
        JSON.stringify(token_obj),
        {
            expirationTtl: 3600,
        },
    )
    return c.json({
        message: "go to /auth_kv to try this token",
        token: token_obj.token_id,
    })
})

// Rate limit
import { setRateLimit, setRateLimitByUser } from "./utils_limiter"
app.use("/rate_limit/*", setRateLimit("id_of_15s_rate_limit", { rate: 15000 }))
app.all("/rate_limit/*", basicProxy(target_url))

// Rate limit per user
app.get("/rate_limit_user/init", async (c) => {
    return c.redirect(`/auth_kv/init?group=${c.req.query("group") || ""}`)
})
app.use("/rate_limit_user/*", validateTokenByKv())
app.use(
    "/rate_limit_user/*",
    setRateLimitByUser("id_of_15s_rate_limit_prefix", { rate: 15000 }),
)
app.all("/rate_limit_user/*", basicProxy(target_url))

// Quota limit
import { setQuotaLimit, setQuotaLimitByIp } from "./utils_limiter"
app.use(
    "/quota_limit/*",
    setQuotaLimit("id_quota_limit_1_req_per_2_minute", {
        limit: 1,
        interval: 2,
        interval_unit: "minute",
    }),
) // 1 requests per 2 minutes
app.all("/quota_limit/*", basicProxy(target_url))

// Quota limit per IP
app.use(
    "/quota_limit_ip/*",
    setQuotaLimitByIp("id_quota_limit_prefix", {
        limit: 2,
        interval: 1,
        interval_unit: "minute",
    }),
) // 2 requests per minute
app.all("/quota_limit_ip/*", basicProxy(target_url))

// Cache
import { cache } from "hono/cache"
app.use(
    "/cache/*",
    cache({
        cacheName: "cache",
        cacheControl: "max-age=10",
    }),
)
app.all("/cache/*", basicProxy(target_url))

// Forward other protocal to target
import { useWebsocket, getWebsocketTarget } from "./utils_basic"
app.all("/websocket/*", basicProxy(target_ws_url))
app.all("/socketio/*", basicProxy(target_sio_url))
// app.all("/grpc/*", basicProxy(target_grpc_url))  // not work

// Handle websocket in Cloudflare worker
app.use("/websocket_server/*", useWebsocket())
app.all("/websocket_server/*", async (c) => {
    const server = c.get("ws_server")
    if (server == undefined) {
        throw new Error("websocket is undefined")
    }
    server.addEventListener("message", (event) => {
        const data = {
            ...JSON.parse(event.data),
            server: "cf-worker-server",
        }
        server.send(JSON.stringify(data))
    })
})

// Cloudflare worker as websocket proxy
app.use("/websocket_proxy/*", useWebsocket())
app.all("/websocket_proxy/*", async (c) => {
    const target = await getWebsocketTarget(target_ws_url)
    const server = c.get("ws_server")
    if (server == undefined) {
        throw new Error("websocket is undefined")
    }
    // ugly, maybe it can still use middleware pattern
    server.addEventListener("close", (_) => target.close())
    server.addEventListener("message", (event) => {
        target.send(event.data)
    })
    target.addEventListener("close", (_) => server.close())
    target.addEventListener("message", (event) => {
        let data = { message: event.data }
        try {
            data = JSON.parse(event.data)
        } catch (e) {}
        data["server"] = "cf-worker-proxy"
        server.send(JSON.stringify(data))
    })
})

// Redirect To README
app.all("/", async (c) =>
    c.redirect("https://github.com/linnil1/hono-cf-proxy"),
)

// Error handling
app.onError((err, c) => {
    if (err instanceof HTTPException) {
        c.status(err.status)
        const headers = err.res?.headers
        return c.json(
            { error: err.message || err.res?.statusText },
            err.status,
            headers ? Object.fromEntries(headers) : {},
        )
    }
    console.error(`${err}`)
    return c.json({ error: "Error Occur" }, 500)
})

app.notFound((c) => {
    return c.json({ error: "Not Found" }, 404)
})

export default app
