import { Hono } from "hono"
import { HTTPException } from "hono/http-exception"

import { proxy_simple, proxy_with_var, request_to_var } from "./utils_basic"

export { RateLimiter } from "./rate_limiter"
export { QuotaLimiter } from "./quota_limiter"

type Bindings = {
    RATE: DurableObjectNamespace
    QUOTA: DurableObjectNamespace
    DATA: KVNamespace
    DB: D1Database
    github_client_id: string // set in .dev.vars
    github_client_secret: string // set in .dev.vars
}
type Variables = {
    method: string
    headers: Record<string, string>
    queries: Record<string, string>
    body?: string
}

const app = new Hono<{
    Bindings: Bindings
    Variables: Variables
}>()

// for debug: run `python backend-api.py` as target
// const target_url = "http://localhost:5000"
const target_url = "https://httpbun.com"

// Proxy to target
app.all("/app1/*", proxy_simple(target_url))

// Modify the response data(header, status code, data)
app.use("/app2/*", async (c, next) => {
    await next()
    c.header("in_after_rep", "add_in_after_rep_value")
    c.res.headers.delete("Server")
    c.status(204)
    const data = JSON.parse(await c.res.text())
    data["response_headers"] = Object.fromEntries(c.res.headers)
    // If await c.req.xx() is called
    // A new response should overwrite the c.res object
    c.res = c.newResponse(
        JSON.stringify(data),
        c.res.status,
        Object.fromEntries(c.res.headers),
    )
})
app.all("/app2/*", proxy_simple(target_url))

// app3: Rewrite the request
app.use("/app3/*", request_to_var())
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
app.all("/app3/*", proxy_with_var(target_url))

// app4-0: Authorization with hard-coded token
// https://github.com/honojs/hono/blob/main/src/middleware/bearer-auth/index.ts
import { bearerAuth } from "hono/bearer-auth"
app.use("/app4-0/*", bearerAuth({ token: "token1" }))
app.all("/app4-0/*", proxy_simple(target_url))

// app4-1: Authorization by Basic auth
// https://github.com/honojs/hono/blob/main/src/middleware/basic-auth/index.ts
import { basicAuth } from "hono/basic-auth"
app.use("/app4-1/*", basicAuth({ username: "linnil1", password: "linnil1" }))
app.all("/app4-1/*", proxy_simple(target_url))

// app5: Authroization by dynamic KV
// app5-0: Init the KV
// app5-1: Validate the token using KV,
//         this is almost the same with the validate user/password
import { validate_token_by_simple_kv, show_user } from "./utils_auth"
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
app.use("/app5/*", validate_token_by_simple_kv())
app.all("/app5/*", show_user())

// app6: Authorization by JWT
import { jwt, sign } from "hono/jwt"
import { jwt_to_user } from "./utils_auth"
app.get("/app6/init", async (c) => {
    // you can retrieve from KV
    const data = {
        user_id: "linnil1",
        username: "linnil1",
        exp: Math.floor(Date.now() / 1000) + 60 * 5, // 5mins
    }
    return c.json({ token: await sign(data, "it-is-very-secret", "HS256") })
})
app.use("/app6/*", jwt({ secret: "it-is-very-secret" }))
app.use("/app6/*", jwt_to_user())
app.all("/app6/*", show_user())

// app7: Authroization by dynamic KV with separated user and token
// This implementation allow multiple token for user
import { validate_token_by_kv, generate_token_id } from "./utils_auth"
app.get("/app7/init", async (c) => {
    const data_user = {
        username: "linnil1",
        user_id: "linnil1",
        groups:
            c.req.query("group") == "group1"
                ? ["group1", "group2"]
                : ["group2"],
    }
    const data_token = {
        token_id: await generate_token_id(c),
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
app.use("/app7/*", validate_token_by_kv())
app.all("/app7/*", show_user())

// APP6: Group permission
// And allow group1 to access, i.e. linnil1 can access but linnil2 cannot
app.get("/app8/init", async (c) => {
    const name = c.req.query("name")
    if (!name)
        throw new HTTPException(400, { message: "?name=linnil1 is required" })
    return c.redirect(`/app7-0?group={name}`)
})
import { group_permission } from "./utils_auth"
app.use("/app8/*", validate_token_by_kv())
app.use("/app8/*", group_permission("group1"))
app.all("/app8/*", show_user())

// app9: All table are save in D1(SQL)
import { validate_token_by_sql } from "./utils_auth"
app.use("/app9/*", validate_token_by_sql())
app.use("/app9/*", group_permission("group1"))
app.all("/app9/*", show_user())

// app10: Add rate limit
import { rate_limit, rate_limit_by_user } from "./utils_limiter"
app.use("/app10/*", rate_limit(15000, "app10_15s_rate_limit"))
app.all("/app10/*", proxy_simple(target_url))

// app10-1: Rate limit per user
app.use("/app10-1/*", validate_token_by_kv())
app.use("/app10-1/*", rate_limit_by_user(15000, "app10_1_rate_15s_peruser"))
app.all("/app10-1/*", proxy_simple(target_url))

// app11: Add Quota limit
// Quota limit per user is the same as rate limiter
import { quota_limit, quota_limit_by_ip } from "./utils_limiter"
app.use("/app11/*", quota_limit("app11_quota", 1, 2, "minute")) // 1 requests per 2 minutes
app.all("/app11/*", proxy_simple(target_url))
app.use("/app11-1/*", quota_limit_by_ip("app11_quota", 2, 1, "minute")) // 2 requests per minute
app.all("/app11-1/*", proxy_simple(target_url))

// app12: cache
import { cache } from "hono/cache"
app.use(
    "/app12/*",
    cache({
        cacheName: "app12",
        cacheControl: "max-age=10",
    }),
)
app.all("/app12/*", proxy_simple(target_url))

// use Github to login
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
    const token_id = await generate_token_id(c)
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
