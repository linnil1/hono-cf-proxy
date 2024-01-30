import { Hono } from "hono"

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

    async fetch(request: Request) {
        return this.app.fetch(request)
    }
}
