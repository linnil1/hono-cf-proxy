import type { MiddlewareHandler } from "hono"
import { HTTPException } from "hono/http-exception"

// Middleware for set rate limit
// It will connect to DO to check if the id exceed rate limit
export function setRateLimit(rate: number, id: string): MiddlewareHandler {
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

// Append user_id into DO id
// This require validateTokenByxx middleware
export function setRateLimitByUser(
    rate: number,
    id: string,
): MiddlewareHandler {
    return async (c, next) => {
        const new_id = id + "_user" + c.get("user").user_id
        // console.log(new_id)
        return setRateLimit(rate, new_id)(c, next)
    }
}

// set Quota limit
export function setQuotaLimit(
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

// Append IP into DO id
// This require cloudflare worker
export function setQuotaLimitByIp(
    id: string,
    limit: number,
    interval: number = 1,
    interval_unit: string = "second",
): MiddlewareHandler {
    return async (c, next) => {
        const ip = c.req.header("Cf-Connecting-Ip") || ""
        const new_id = id + "_ip_" + ip
        return setQuotaLimit(new_id, limit, interval, interval_unit)(c, next)
    }
}
