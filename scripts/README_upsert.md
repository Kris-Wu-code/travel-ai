Upsert places from normalized JSON

Usage examples:

Generate SQL for BUPT Shahe normalized file:

```bash
node scripts/upsert_places_from_normalized.js --input=scripts/data/bupt_shahe.normalized.json --out=scripts/data/bupt_shahe.upsert.sql
```

Then apply with psql or Supabase SQL editor (service role):

```bash
psql "postgres://user:pass@host:5432/dbname" -f scripts/data/bupt_shahe.upsert.sql
```

Notes:
- The script is tolerant to a few normalized JSON shapes (array, GeoJSON FeatureCollection).
- It writes INSERT ... ON CONFLICT (source, source_id) DO UPDATE ... using `geom` as geography.
- Review the generated SQL before applying to production.

One-command pipeline (recommended)

Run full OSM pipeline and import into `places`:

```bash
npm run pipeline:places -- --dataset=bupt_shahe
npm run pipeline:bupt-shahe:places
npm run pipeline:forbidden-city:places
```

Dry run on existing normalized file (skip network fetch/normalize):

```bash
npm run pipeline:bupt-shahe:places:dry
```

Pipeline stages:
- fetch (Overpass)
- normalize (dataset-specific classifier)
- upsert (Supabase API, source/source_id idempotent)
- verify (checks imported key coverage in `places`)

How to add a new dataset:
- Add one entry in `scripts/osm/datasets.config.js`
- Provide `fetchScript`, `normalizeScript`, `normalizedFile`
- Reuse the generic pipeline command: `npm run pipeline:places -- --dataset=your_dataset`
