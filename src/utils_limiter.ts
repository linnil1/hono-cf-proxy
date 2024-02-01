import type { MiddlewareHandler } from "hono"
import { HTTPException } from "hono/http-exception"

// Middleware for set rate limit
// It will connect to DO to check if the id exceed rate limit
export function setRateLimit(
    id: string,
    options: { rate: number } = { rate: 1000 },
): MiddlewareHandler {
    return async (c, next) => {
        const obj = c.env.RATE.get(c.env.RATE.idFromName(id))
        const rep = await obj.fetch(
            "http://localhost/query?rate=" + options.rate.toString(),
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
    id: string,
    options: any,
): MiddlewareHandler {
    return async (c, next) => {
        const new_id = id + "_user" + c.get("user").user_id
        // console.log(new_id)
        return setRateLimit(new_id, options)(c, next)
    }
}

// set Quota limit
export function setQuotaLimit(
    id: string,
    options: {
        limit: number
        interval: number
        interval_unit: string
    } = {
        limit: 1,
        interval: 1,
        interval_unit: "second",
    },
): MiddlewareHandler {
    return async (c, next) => {
        const obj = c.env.QUOTA.get(c.env.QUOTA.idFromName(id))
        // turn options to record<str:str>
        const options_record = Object.fromEntries(
            Object.entries(options).map(([key, value]) => [
                String(key),
                String(value),
            ]),
        )
        console.log(options_record)
        const rep = await obj.fetch(
            "http://localhost/query?" + new URLSearchParams(options_record),
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
export function setQuotaLimitByIp(id: string, options: any): MiddlewareHandler {
    return async (c, next) => {
        const ip = c.req.header("Cf-Connecting-Ip") || ""
        const new_id = id + "_ip_" + ip
        return setQuotaLimit(new_id, options)(c, next)
    }
}
