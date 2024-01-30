import type { MiddlewareHandler } from "hono"
import { HTTPException } from "hono/http-exception"

export function rate_limit(rate: number, id: string): MiddlewareHandler {
    return async (c, next) => {
        const obj = c.env.RATE.get(c.env.RATE.idFromName(id))
        const rep = await obj.fetch(
            "http://localhost/query?rate=" + rate.toString(),
        )
        if (rep.status != 200) {
            throw new HTTPException(429, {
                message: "Rate Limit Exceeded",
            })
        }
        await next()
    }
}

// append user_id into DO id
// This require validate_token_xx middleware
export function rate_limit_by_user(
    rate: number,
    id: string,
): MiddlewareHandler {
    return async (c, next) => {
        const new_id = id + "_user" + c.get("user").user_id
        // console.log(new_id)
        return rate_limit(rate, new_id)(c, next)
    }
}

export function quota_limit(
    id: string,
    limit: number,
    interval: number = 1,
    interval_unit: string = "second",
): MiddlewareHandler {
    return async (c, next) => {
        const obj = c.env.QUOTA.get(c.env.QUOTA.idFromName(id))
        const rep = await obj.fetch(
            `http://localhost/query?limit=${limit.toString()}&interval_unit=${interval_unit}&interval=${interval}`,
        )
        if (rep.status != 200) {
            throw new HTTPException(429, {
                message: "Rate Limit Exceeded",
            })
        }
        await next()
    }
}

export function quota_limit_by_ip(
    id: string,
    limit: number,
    interval: number = 1,
    interval_unit: string = "second",
): MiddlewareHandler {
    return async (c, next) => {
        const ip = c.req.header("Cf-Connecting-Ip") || ""
        const new_id = id + "_ip_" + ip
        return quota_limit(new_id, limit, interval, interval_unit)(c, next)
    }
}
