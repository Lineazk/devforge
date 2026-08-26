# DevForge — Zero-Telemetry Developer Workbench

> Fast, private, client-side developer utility suite for everyday engineering workflows.

Live Web App: **[https://lineazk.github.io/devforge/](https://lineazk.github.io/devforge/)**

---

## Overview

Modern developer workflows frequently involve converting cURL commands to application code, generating strongly-typed interfaces from JSON payloads, decoding JWT tokens to check expiration, computing cryptographic digests, and evaluating regular expressions or cron schedules.

Many existing web utilities send developer inputs (often containing sensitive API keys, bearer tokens, or proprietary payload schemas) to backend servers for processing.

**DevForge** is built with a strict **Zero-Telemetry, 100% Client-Side** architecture. All transformations, cryptographic calculations, schema parsing, and token evaluations are computed entirely in your browser using standard Web APIs. No data ever leaves your machine.

---

## Core Features & Modules

### 1. ⚡ cURL to Multi-Language Code Generator
Convert raw cURL requests into clean, idiomatic code for 11 programming languages:
- **JavaScript**: `fetch` API and `axios`
- **Python**: `requests` and `httpx` (async)
- **Go**: `net/http` standard library
- **Rust**: `reqwest` async with `tokio`
- **C#**: `HttpClient` (.NET)
- **PHP**: `cURL` extension
- **Java**: `java.net.http.HttpClient` (Java 11+)
- **Swift**: `URLSession` (iOS / macOS)

### 2. 🧩 JSON to Types & Schema Workbench
Generate strongly-typed models from arbitrary JSON payloads:
- **TypeScript**: `interface` and `type` declarations
- **Python**: `Pydantic v2` `BaseModel` and `@dataclass`
- **Go**: `struct` with `json:"..."` tags
- **Rust**: `struct` with `serde::{Serialize, Deserialize}` annotations
- **JSON Schema**: Draft-07 standard specification
- **PostgreSQL**: `CREATE TABLE` DDL with inferred column types

### 3. 🔑 JWT Token Inspector & Expiry Monitor
- Decodes JWT Header and Payload with real-time Base64URL parsing.
- Live expiration countdown clock showing remaining validity or elapsed expiration.
- Detailed standard claim breakdown (`iss`, `sub`, `aud`, `exp`, `iat`, `nbf`, `jti`).
- Guaranteed private: tokens are never transmitted to external servers.

### 4. 🔒 Web Crypto & Encoders
- **Hashes**: SHA-256, SHA-512, SHA-384, SHA-1, and MD5.
- **Signatures**: HMAC-SHA256 signer.
- **Encoding**: UTF-8 safe Base64 and URL encoding/decoding.

### 5. 🆔 UUID v4 & Time-Ordered UUID v7 Studio
- Generate standard RFC 4122 random **UUID v4**.
- Generate time-sortable **UUID v7** with embedded millisecond timestamp extraction.
- Batch generation (1 to 100 UUIDs) with uppercase, hyphenated, and raw formats.

### 6. 📊 Text Diff, Regex Studio & Case Converter
- Line-by-line diff comparison with added/removed metric badges.
- Live Regex tester with match highlights, capture group breakdown, and 8 built-in presets.
- Identifier case converter (`camelCase`, `PascalCase`, `snake_case`, `CONSTANT_CASE`, `kebab-case`, `Title Case`).

### 7. ⏱️ Cron Schedule & Unix Epoch Time Converter
- 5-part cron expression translator into plain English with next 5 scheduled executions.
- Unix timestamp converter (seconds/milliseconds to ISO 8601, UTC, and relative time).

---

## Community Attribution & Identity

Created by me with AI-assisted development.

- **Public DID**: `did:key:z6MkgVJ4NDcTqg5zrYahDYpBsrskw48AxbvM5NqstqroLoud`
- **Community contribution**: `@flop_labs`

> *Disclaimer: This project is an independent community contribution for @flop_labs and is not an official Flop Labs project.*

---

## License

MIT License. Open source and free for all developers.
