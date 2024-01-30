class User {
    id: string
    github_id: string
    name: string
    email: string
    create_time: string
    tokens: string[] = []

    static async setByGithubOauth(
        kv: KVNamespace,
        github_user: Object,
    ): Promise<User> {
        // avoid overwrite user
        const user1 = await User.get(kv, github_user["id"])
        if (user1) {
            return user1
        }
        const user = new User()
        user.id = github_user["id"] // TODO: check doc
        user.github_id = github_user["id"]
        user.name = github_user["login"]
        user.create_time = new Date().toISOString()
        user.update(kv)
        return user
    }

    static async get(kv: KVNamespace, id: String): Promise<User | null> {
        const json = await kv.get("user-" + id, { type: "json" })
        if (!json) {
            return null
        }
        return Object.assign(new User(), json)
    }

    async update(kv: KVNamespace): Promise<void> {
        await kv.put("user-" + this.github_id, JSON.stringify(this))
    }
}

class Token {
    id: string
    user_id: string
    created_at: string

    // set
    static async set(
        kv: KVNamespace,
        user: User,
        id: String = "",
        ttl: number = 3600,
    ): Promise<string> {
        let token = new Token()
        console.log("token" + id)
        token.id = id || crypto.randomUUID()
        token.user_id = user.id
        token.created_at = new Date().toISOString()
        user.tokens.push(token.id)
        user.update(kv)
        await kv.put("token-" + token.id, JSON.stringify(token), {
            expirationTtl: ttl,
        })
        return token.id
    }

    static async getUser(
        kv: KVNamespace,
        token_id: String,
    ): Promise<User | null> {
        const json: Token = await kv.get("token-" + token_id, { type: "json" })
        if (!json) {
            return null
        }
        const token = Object.assign(new Token(), json)
        return await User.get(kv, token.user_id)
    }

    static async delete(
        kv: KVNamespace,
        user: User,
        token_id: String,
    ): Promise<void> {
        if (user.tokens.indexOf(token_id) < 0) {
            return false
        }
        const a = await kv.delete("token-" + token_id)
        console.log(a)
        return true
    }
}

export { User, Token }
