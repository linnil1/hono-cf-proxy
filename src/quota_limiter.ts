import { Hono } from "hono"

function truncKDigit(num: number, k: number): number {
    return Math.floor(num / k) * k
}

function intervalToSeconds(interval: string): number {
    const intervalMap: Record<string, number> = {
        second: 1,
        minute: 60,
        hour: 60 * 60,
        day: 60 * 60 * 24,
        month: 60 * 60 * 24 * 31,
        year: 60 * 60 * 24 * 365,
    }
    return intervalMap[interval] || 0
}

function truncDatetime(interval: string, k: number = 1): Date {
    const seconds = intervalToSeconds(interval)
    let date = new Date()
    date.setUTCMilliseconds(0)
    if (seconds > intervalToSeconds("second")) date.setUTCSeconds(0)
    if (seconds > intervalToSeconds("minute")) date.setUTCMinutes(0)
    if (seconds > intervalToSeconds("hour")) date.setUTCHours(0)
    if (seconds > intervalToSeconds("day")) date.setUTCDate(1)
    if (seconds > intervalToSeconds("month")) date.setUTCMonth(0)
    if (interval == "second")
        date.setUTCSeconds(truncKDigit(date.getUTCSeconds(), k))
    if (interval == "minute")
        date.setUTCMinutes(truncKDigit(date.getUTCMinutes(), k))
    if (interval == "hour") date.setUTCHours(truncKDigit(date.getUTCHours(), k))
    if (interval == "day") date.setUTCDate(truncKDigit(date.getUTCDate(), k))
    if (interval == "month")
        date.setUTCMonth(truncKDigit(date.getUTCMonth(), k))
    if (interval == "year")
        date.setUTCFullYear(truncKDigit(date.getUTCFullYear(), k))
    return date
}

export class QuotaLimiter {
    // set [number] of quota per [k] [second|minute|...]
    key: string = ""
    counter: number = 0
    state: DurableObjectState
    app: Hono = new Hono()

    constructor(state: DurableObjectState) {
        this.state = state
        this.state.blockConcurrencyWhile(async () => {
            this.key = (await this.state.storage?.get<string>("key")) || "None"
            this.counter =
                (await this.state.storage?.get<number>("counter")) || 0
        })

        this.app.get("/query", async (c) => {
            const k = parseInt(c.req.query("interval") || "1")
            const interval_unit = c.req.query("interval_unit") || "second"
            const seconds = intervalToSeconds(interval_unit) * k
            if (seconds == 0) return c.json({ status: "invalid interval" }, 400)
            const ttl_seconds = seconds > 60 ? seconds : 60
            const datetime = truncDatetime(interval_unit, k)
            const limit = parseInt(c.req.query("limit") || "1")
            let key = datetime.toISOString()

            if (key != this.key) {
                this.key = key
                await this.state.storage?.put("key", this.key, {
                    expirationTtl: ttl_seconds,
                })
                this.counter = 0
            }
            this.counter += 1
            console.log(this.key, this.counter)
            if (this.counter > limit)
                return c.json({ status: "rate limit exceeded" }, 429)
            await this.state.storage?.put("counter", this.counter, {
                expirationTtl: ttl_seconds,
            })
            return c.json({ status: "ok" })
        })
    }

    async fetch(request: Request) {
        return this.app.fetch(request)
    }
}
