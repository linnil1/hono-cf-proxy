import type { MiddlewareHandler } from "hono"
import { HTTPException } from "hono/http-exception"

/**
 * Middleware function to enforce rate limits by connecting to a Durable Object (DO).
 * It checks if the specified rate limit is exceeded by the provided ID.
 *
 * @param {string} id The identifier for the rate limit.
 * @param {Object} [options] The options object.
 * @param {number} [options.rate=1000] The rate limit in requests per second.
 * @returns {MiddlewareHandler} The Hono middleware.
 */
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

/**
 * Middleware function to enforce rate limits with user-specific identifiers.
 * Appends the user ID to the rate limit identifier.
 * Requires validation (validateTokenByXx) for accessing user object.
 *
 * @param {string} id The identifier for the rate limit.
 * @param {Object} [options] The options object.
 * @returns {MiddlewareHandler} The middleware handler function.
 */
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

/**
 * Middleware function to enforce quota limits by connecting to a data object (DO).
 * It checks if the specified quota limit is exceeded by the provided ID.
 *
 * @param {string} id The identifier for the quota limit.
 * @param {Object} [options] The options object for quota limiting.
 * @param {number} [options.limit=1] The maximum allowed quota limit.
 * @param {number} [options.interval=1] The time interval for the quota limit.
 * @param {string} [options.interval_unit='second'] The unit of the time interval (e.g., 'second', 'minute', 'hour', 'day', 'month', 'year').
 * @returns {MiddlewareHandler} The middleware handler function.
 */
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

/**
 * Middleware function to enforce quota limits by connecting to a data object (DO).
 * It checks if the specified quota limit is exceeded by Client IP.
 *
 * @param {string} id The identifier for the quota limit.
 * @param {Object} [options] The options object for quota limiting.
 * @returns {MiddlewareHandler} The middleware handler function.
 */
export function setQuotaLimitByIp(id: string, options: any): MiddlewareHandler {
    return async (c, next) => {
        const ip = c.req.header("Cf-Connecting-Ip") || ""
        const new_id = id + "_ip_" + ip
        return setQuotaLimit(new_id, options)(c, next)
    }
}
