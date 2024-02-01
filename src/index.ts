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
    github_client_id: string // set in .dev.vars
    github_client_secret: string // set in .dev.vars
    jwt_secret: string // set in .dev.vars
}
type Variables = {
    method: string
    headers: Record<string, string>
    queries: Record<string, string>
    body?: string
    resp?: string
    status?: number
}

const app = new Hono<{
    Bindings: Bindings
    Variables: Variables
}>()

// for debug: run `python backend-api.py` as target
// const target_url = "http://localhost:5000"
const target_url = "https://httpbin.org/anything"

// Proxy to target
app.all("/app1/*", basicProxy(target_url))

// Modify the response data(header, status code, data)
app.use("/app2/*", async (c, next) => {
    await next()
    console.log(c.res.status, Object.fromEntries(c.res.headers))
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
app.all("/app2/*", basicProxy(target_url))

// Rewrite the request
import { extractReqVar, proxyReqVar } from "./utils_basic"
app.use("/app3/*", extractReqVar())
app.use("/app3/*", async (c, next) => {
    let querys = c.get("queries")
    querys["query"] = "add_query_value"
    let data = JSON.parse(c.get("body") || "{}")
    data["body"] = "add_body_value"
    c.set("body", JSON.stringify(data))
    c.set("method", "POST")
    c.req.path = "/post" // force replace /app3 prefix
    await next()
})
app.all("/app3/*", proxyReqVar(target_url))

// Rewrite the request and response
import { handleReqResVar, variableProxy } from "./utils_basic"
app.use("/app3-1/*", handleReqResVar())
app.use("/app3-1/*", async (c, next) => {
    let querys = c.get("queries")
    querys["query"] = "add_query_value"
    c.set("queries", querys)
    await next()
    let body = JSON.parse(c.get("resp") || "{}")
    body["add_resp"] = true
    c.set("resp", JSON.stringify(body, null, " "))
})
app.all("/app3-1/*", variableProxy(target_url))

// Authorization with hard-coded token
// https://github.com/honojs/hono/blob/main/src/middleware/bearer-auth/index.ts
import { bearerAuth } from "hono/bearer-auth"
app.get("/app4-0/init", async (c) => c.json({ token: "token1" }))
app.use("/app4-0/*", bearerAuth({ token: "token1" }))
app.all("/app4-0/*", basicProxy(target_url))

// Authorization by Basic auth
// https://github.com/honojs/hono/blob/main/src/middleware/basic-auth/index.ts
import { basicAuth } from "hono/basic-auth"
app.get("/app4-1/init", async (c) =>
    c.json({ username: "linnil1", password: "linnil1" }),
)
app.use("/app4-1/*", basicAuth({ username: "linnil1", password: "linnil1" }))
app.all("/app4-1/*", basicProxy(target_url))

// Authroization by dynamic KV
// * Init the KV
// * Validate the token using KV,
//   this is almost the same with the validate user/password
import { validateTokenBySingleKey, returnUserInfo } from "./utils_auth"
app.get("/app5/init", async (c) => {
    const token = "token1"
    const data = {
        token_id: token,
        username: "linnil1",
        user_id: "linnil1",
    }
    await c.env.DATA.put(`token-${token}`, JSON.stringify(data))
    return c.json({ token })
})
app.use("/app5/*", validateTokenBySingleKey())
app.all("/app5/*", returnUserInfo())

// Authorization by JWT
import { jwt, sign } from "hono/jwt"
import { extractUserFromJWT } from "./utils_auth"
app.get("/app6/init", async (c) => {
    // you can retrieve from KV
    const data = {
        user_id: "linnil1",
        username: "linnil1",
        exp: Math.floor(Date.now() / 1000) + 60 * 5, // 5mins
    }
    return c.json({ token: await sign(data, c.env.jwt_secret, "HS256") })
})
app.use(
    "/app6/*",
    async (c, next) => await jwt({ secret: c.env.jwt_secret })(c, next),
)
app.use("/app6/*", extractUserFromJWT())
app.all("/app6/*", returnUserInfo())

// Authroization by dynamic KV with separated user and token
// This implementation allow multiple token for user
import { validateTokenByKv, generateTokenId } from "./utils_auth"
app.get("/app7/init", async (c) => {
    const data_user = {
        username: "linnil1",
        user_id: "linnil1",
        // for app8
        groups:
            c.req.query("group") == "group1"
                ? ["group1", "group2"]
                : ["group2"],
    }
    const data_token = {
        token_id: await generateTokenId(c),
        user_id: data_user.user_id,
    }
    await c.env.DATA.put(`user-${data_user.user_id}`, JSON.stringify(data_user))
    await c.env.DATA.put(
        `token-${data_token.token_id}`,
        JSON.stringify(data_token),
        { expirationTtl: 3600 },
    )
    return c.json({ token: data_token.token_id })
})
app.use("/app7/*", validateTokenByKv())
app.all("/app7/*", returnUserInfo())

// Group permission
// And allow group1 to access, i.e. linnil1 can access but linnil2 cannot
app.get("/app8/init", async (c) => {
    const name = c.req.query("name")
    if (!name)
        throw new HTTPException(400, { message: "?name=linnil1 is required" })
    return c.redirect(`/app7/init?group=${name}`)
})
import { group_permission } from "./utils_auth"
app.use("/app8/*", validateTokenByKv())
app.use("/app8/*", group_permission("group1"))
app.all("/app8/*", returnUserInfo())

// All table are save in D1(SQL)
import { validateTokenBySql } from "./utils_auth"
app.get("/app9/init", async (c) => {
    const group_name = c.req.query("group")
    if (!group_name)
        throw new HTTPException(400, { message: "?group=linnil1 is required" })
    while (true) {
        const token = crypto.randomUUID()
        try {
            const result = await c.env.DB.prepare(
                "INSERT INTO tokens (token_id, user_id, expires_at) VALUES (?, ?, ?)",
            )
                // expire at 60 mins
                .bind(
                    token,
                    group_name == "linnil1" ? 1 : 2,
                    new Date(Date.now() + 60 * 60 * 1000).toISOString(),
                )
                .run()
            return c.json({ token })
        } catch (e: any) {
            console.log(e)
        }
    }
})
app.use("/app9/*", validateTokenBySql())
app.use("/app9/*", group_permission("group1"))
app.all("/app9/*", returnUserInfo())

// Add rate limit
import { setRateLimit, setRateLimitByUser } from "./utils_limiter"
app.use("/app10/*", setRateLimit(15000, "app10_15s_setRateLimit"))
app.all("/app10/*", basicProxy(target_url))

// Rate limit per user
app.get("/app10-1/init", async (c) => {
    c.redirect("/app7/init?group=linnil1")
})
app.use("/app10-1/*", validateTokenByKv())
app.use("/app10-1/*", setRateLimitByUser(15000, "app10_1_rate_15s_peruser"))
app.all("/app10-1/*", basicProxy(target_url))

// Add Quota limit
// Quota limit per user is the same as rate limiter
// Quota limit by ip can also be implement for rate limiter
import { setQuotaLimit, setQuotaLimitByIp } from "./utils_limiter"
app.use("/app11/*", setQuotaLimit("app11_quota", 1, 2, "minute")) // 1 requests per 2 minutes
app.all("/app11/*", basicProxy(target_url))
app.use("/app11-1/*", setQuotaLimitByIp("app11_quota", 2, 1, "minute")) // 2 requests per minute
app.all("/app11-1/*", basicProxy(target_url))

// Cache
import { cache } from "hono/cache"
app.use(
    "/app12/*",
    cache({
        cacheName: "app12",
        cacheControl: "max-age=10",
    }),
)
app.all("/app12/*", basicProxy(target_url))

// Use Github to login
import { githubAuth } from "@hono/oauth-providers/github"
app.use(
    "/user/auth/github",
    async (c, next) =>
        await githubAuth({
            client_id: c.env.github_client_id,
            client_secret: c.env.github_client_secret,
        })(c, next),
)

app.get("/user/auth/github", async (c) => {
    // save github user into KV
    // use github id as user-id
    const github_user = c.get("user-github")
    if (!github_user) throw new HTTPException(401, { message: "Unauthorized" })
    console.log(github_user)
    // github_user["kv_create_at"] = new Date().toISOString()
    await c.env.DATA.put("user-" + github_user.id, JSON.stringify(github_user))
    const token_id = await generateTokenId(c)
    const token_obj = {
        token_id: token_id,
        user_id: github_user.id,
        create_at: new Date().toISOString(),
    }
    await c.env.DATA.put("token-" + token_id, JSON.stringify(token_obj), {
        expirationTtl: 3600,
    })
    return c.json({
        token: token_id,
    })
})

// error handling
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

// export
export default app
