# Provider API Key Rotation

JARVIS can hold multiple API keys per provider and rotate them without restarts.

## Behaviour

- **Daily rotation** — the first provider call of each UTC day advances to the
  next key. The same key is reused for the rest of that day.
- **Immediate failover** — on `HTTP 429`, the current key is put on cooldown
  until the next UTC midnight and the next usable key is tried for the same
  request.
- **Cooldown recovery** — expired cooldowns are re-activated automatically.
- **Fallback** — if the pool is empty, the environment key
  (`OPENROUTER_API_KEY`) is used exactly as before.
- Keys are encrypted at rest with AES-256-GCM (`lib/secrets.js`); list
  endpoints never return key material.

## API

| Method | Path | Permission |
|---|---|---|
| `GET` | `/v1/provider-keys?provider=openrouter` | `read` |
| `POST` | `/v1/provider-keys` | `provider:write` |
| `DELETE` | `/v1/provider-keys/:id` | `provider:write` |

Add a key:

```bash
curl -X POST http://127.0.0.1:3100/v1/provider-keys \
  -H "authorization: Bearer <session-or-owner-token>" \
  -H "content-type: application/json" \
  -d '{"provider":"openrouter","label":"account-1","key":"sk-or-v1-..."}'
```

Labels are unique per provider; re-posting the same label replaces that key and
re-activates it. Supported providers: `openrouter`, `ollama-cloud`, `openai`,
`anthropic`.

## Storage

- `provider_api_keys` — encrypted keys, status, cooldown, last use.
- `provider_key_rotation` — current day and current key per provider.

## Note on accounts

Rotation spreads load across keys you are entitled to use. It does not change
each provider's own per-account limits, and creating extra accounts to exceed
those limits is governed by the provider's terms.
