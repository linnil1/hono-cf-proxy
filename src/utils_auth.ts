import { HTTPException } from "hono/http-exception"
import type { Context, Handler, MiddlewareHandler } from "hono"

export async function generate_token_id(c: Context) {
    while (true) {
        const token_id = crypto.randomUUID()
        const token_test = await c.env.DATA.get(`token-${token_id}`)
        if (!token_test) return token_id
    }
}

// Use a token to get token object
export function validate_token_by_simple_kv(): MiddlewareHandler {
    return async (c, next) => {
        const headerToken = c.req.header("Authorization")
        if (!headerToken || !headerToken.startsWith("Bearer "))
            throw new HTTPException(401, {
                message: "Require 'Authorization: Bearer' in Header",
            })
        const token = headerToken.substring(7)
        const token_obj = await c.env.DATA.get(`token-${token}`, {
            type: "json",
        })
        if (!token_obj)
            throw new HTTPException(401, {
                message: "Invalid Token",
            })
        // const header = c.get("headers")
        // delete header["Authorization"]
        // c.set("headers", header)
        c.set("user", token_obj)
        await next()
    }
}

// Use a token to get token object
export function validate_token_by_kv(): MiddlewareHandler {
    return async (c, next) => {
        const headerToken = c.req.header("Authorization")
        if (!headerToken || !headerToken.startsWith("Bearer "))
            throw new HTTPException(401, {
                message: "Require 'Authorization: Bearer' in Header",
            })
        const token = headerToken.substring(7)
        const token_obj = await c.env.DATA.get(`token-${token}`, {
            type: "json",
        })
        if (!token_obj)
            throw new HTTPException(401, {
                message: "Invalid Token",
            })
        const user_obj = await c.env.DATA.get(`user-${token_obj.user_id}`, {
            type: "json",
        })
        if (!user_obj)
            throw new HTTPException(401, {
                message: "Invalid Token",
            })
        // const header = c.get("headers")
        // delete header["Authorization"]
        // c.set("headers", header)
        c.set("user", user_obj)
        await next()
    }
}

export function validate_token_by_sql(): MiddlewareHandler {
    return async (c, next) => {
        // npx wrangler d1 execute example --file init.sql        --local
        const headerToken = c.req.header("Authorization")
        if (!headerToken || !headerToken.startsWith("Bearer "))
            throw new HTTPException(401, {
                message: "Require 'Authorization: Bearer' in Header",
            })
        const token = headerToken.substring(7)
        const stat = c.env.DB.prepare(
            `
SELECT *, GROUP_CONCAT(groups.group_name) AS groups
FROM tokens 
JOIN users ON users.user_id = tokens.user_id AND token_value = ?
JOIN user_groups ON user_groups.user_id = users.user_id
JOIN groups ON user_groups.group_id = groups.group_id
GROUP BY users.user_id;
`,
        ).bind(token)
        const user = await stat.first()
        if (!user)
            throw new HTTPException(401, {
                message: "Invalid Token",
            })
        user["groups"] = user["groups"].split(",")
        // const header = c.get("headers")
        // delete header["Authorization"]
        // c.set("headers", header)
        c.set("user", user)
        await next()
    }
}

export function jwt_to_user(): MiddlewareHandler {
    return async (c, next) => {
        c.set("user", c.get("jwtPayload"))
        await next()
    }
}

export function show_user(): Handler {
    return async (c) => {
        return c.json({ user: c.get("user") })
    }
}

export function group_permission(group_name: string): MiddlewareHandler {
    return async (c, next) => {
        const data = c.get("user")
        // not group_Name not in user's groups list
        if (!data.groups.includes(group_name))
            throw new HTTPException(401, {
                message: "Permission Deny",
            })
        await next()
    }
}
