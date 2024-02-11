import { Hono } from "hono"

/**
 * Rate limiter for controlling the rate of incoming requests.
 * This rate limiter utilizes a Durable Object state to track the timestamp of the last request.
 * It enforces a specified rate limit by comparing the time elapsed since the last request.
 *
 * @property {number} last_timestamp=0 The timestamp of the last request processed by the rate limiter.
 * @property {DurableObjectState} state The Durable Object state for the rate limiter.
 * @property {Hono} app The Hono instance for handling requests.
 *
 * @class RateLimiter
 */
export class RateLimiter {
    last_timestamp: number = 0
    state: DurableObjectState
    app: Hono = new Hono()

    constructor(state: DurableObjectState) {
        this.state = state
        this.state.blockConcurrencyWhile(async () => {
            const stored = await this.state.storage?.get<number>("timestamp")
            this.last_timestamp = stored || 0
        })

        // Handle rate limit queries
        this.app.get("/query", async (c) => {
            const current_timestamp = new Date().getTime()
            const rate = parseFloat(c.req?.query("rate") || "1000")
            console.log(current_timestamp, this.last_timestamp, rate)
            if (current_timestamp - this.last_timestamp < rate) {
                return c.json({ status: "rate limit exceeded" }, 429)
            }
            this.last_timestamp = current_timestamp
            await this.state.storage?.put("timestamp", this.last_timestamp, {
                expirationTtl: rate * 2,
            })
            return c.json({ status: "ok" })
        })
    }

    // Just a adapter for Hono
    async fetch(request: Request) {
        return this.app.fetch(request)
    }
}
