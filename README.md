# cctv.oslo.no

Eit enkelt, ope kart over overvakingskamera i Oslo. Alle kan bidra: legg til
kamera, stadfest om eit estimat faktisk finst, eller flytt eit punkt dersom
plasseringa er feil. Brukarane er anonyme handles og samlar **eyeballs** når dei
bidreg.

> **VI SER DEG OSLO**

## Stack

- **SvelteKit** (Svelte 5) + `@sveltejs/adapter-vercel` — server-kode trengst
  fordi Notion-tokenen må liggje på server, aldri i browseren.
- **Leaflet** for kartet (OpenStreetMap-fliser), lasta klientside.
- **Notion** som einaste backend/datakjelde (databasen `cctv.oslo`).
- "Realtime" = polling kvar ~7 s mot eit lese-endepunkt + optimistisk UI.
- Server-cache med kort TTL held lesinga under Notion si rate-grense (~3 req/s).

## Arkitektur

```
Browser  ──poll 7s──▶  GET  /api/cameras      ─▶ server-cache ─▶ Notion (query)
         ──skriv────▶  POST /api/camera        ─▶ Notion (create page)
         ──skriv────▶  PATCH /api/cameras/[id] ─▶ Notion (update page)
```

- `src/lib/server/notion.ts` — all Notion-tilgang (les/skriv). Server-only.
- `src/lib/server/cache.ts` — TTL-snapshot med request-coalescing.
- `src/lib/stores/cameras.ts` — polling + optimistiske skrivingar med rollback.
- `src/lib/stores/identity.ts` — anonym handle + eyeballs i `localStorage`.
- `src/lib/components/*` — kart, bottom sheet, detalj, bidragsskjema osb.

### Notion-felt som vert brukte

`Namn` (title), `Kategori`, `Eigar / operatør`, `Kamerastatus`
(Stadfesta/Estimert/Ingen/Ukjent), `Breiddegrad`/`Lengdegrad` (posisjon),
`Stadfestingar`, `Semje %`, `Bidragsytarar`, `Bydel / område`, `Sist oppdatert`.

> `Stad` (place) vert ikkje brukt — den eigenskapstypen er ikkje tilgjengeleg via
> det offentlege Notion-API-et. Difor talfelta `Breiddegrad`/`Lengdegrad`.

## Oppsett

```bash
cp .env.example .env      # fyll inn NOTION_TOKEN
npm install
npm run dev
```

### Miljøvariablar

| Variabel                       | Skildring                                          |
| ------------------------------ | -------------------------------------------------- |
| `NOTION_TOKEN`                 | Notion-integrasjonstoken (server-secret).          |
| `NOTION_DATA_SOURCE_ID`        | Data source-id for `cctv.oslo`-databasen.          |
| `NOTION_USERS_DATA_SOURCE_ID`  | Data source-id for `cctv.oslo brukarar`-databasen. |
| `AUTH_SECRET`                  | Lang tilfeldig streng for å signere session-cookie. |
| `CACHE_TTL_MS`                 | (valfritt) cache-TTL i ms, standard 7000.          |

Integrasjonen må ha **begge** databasane (`cctv.oslo` og `cctv.oslo brukarar`)
delt med seg (Notion → Connections).

### Brukarkontoar

Trykk på eyeball-teljaren → lag konto med **brukarnamn + passord** (ingen e-post).
Kontoar er valfrie; utan konto er du ein anonym handle. Passord vert hasha med
scrypt (salt:hash) og lagra i Notion-databasen `cctv.oslo brukarar`; økta er ein
signert HttpOnly-cookie. Innlogga brukarar får eyeballs lagra serverside.

> Handrulla auth for ein open sivil app — ikkje bank-nivå. Ingen e-post tyder at
> **mista passord = mista konto** (inga gjenoppretting).

### Vercel

Legg `NOTION_TOKEN` og `NOTION_DATA_SOURCE_ID` som Project Environment Variables
(Production + Preview). Tokenen skal aldri inn i klient-bundelen eller i git.

## Kommandoar

| Kommando        | Gjer                             |
| --------------- | -------------------------------- |
| `npm run dev`   | Utviklingsserver                 |
| `npm run build` | Produksjonsbygg (adapter-vercel) |
| `npm run check` | Type-/svelte-sjekk               |

## Status / vegkart

- **v1 (no):** kart med statusfarga markørar + tabs, legg til / stadfest /
  estimer / juster plassering, "Nær deg"/Oppdrag-liste, eyeballs + streak lokalt.
- **Seinare:** eigen `Bidrag`-database, server-utrekna semje, biletopplasting,
  polert oppdrag-flyt, rate limiting, delt cache (Vercel KV).
