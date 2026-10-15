# Backup and restore

The local PostgreSQL recovery test restored all 42 tables into a separate database and matched a SHA-256 checksum for a fictional file. See `recovery-test-result.json`. This does **not** verify hosted Supabase Auth export, real private-file restoration, or offsite encrypted backups.

## Production backup procedure (requires provider verification)

1. Choose a restricted backup directory outside this source checkout and outside the primary hosting provider. Grant access only to authorized operators. Use encryption at rest and transport; keys must be kept separately.
2. Use a provider-approved database connection with credentials supplied through a protected environment or password file. Run `pg_dump --format=custom --no-owner --no-acl --file=<restricted-path>/database.dump`. Do not put connection passwords in shell arguments, logs, or source files.
3. Export private storage bytes **and** document metadata/path mappings. Database dumps do not contain Storage object bytes. `scripts/backup-private-files.mjs` downloads private bucket contents and writes a checksum manifest; use a server-only service key and a restricted destination. It has not been run against real files.
4. Encrypt the database dump, file archive, and manifest before copying to secure offsite storage. Keep at least one independent recovery copy according to the company's configured retention policy. No default retention or statutory compliance is assumed.
5. Record backup date, schema migration version, object counts, byte counts, and encryption/key custody information without recording secrets.

## Restore rehearsal

Use a separate Supabase development project or isolated self-hosted environment. Do not overwrite production during rehearsal.

1. Restore database schema and data using `pg_restore --exit-on-error --no-owner --no-acl`. Handle Supabase-managed Auth/Storage schema ownership using the provider's current restore procedure; the local harness is not a substitute.
2. Restore private buckets with `public=false` and required size/type limits; restore file bytes at exact original paths.
3. Verify every SHA-256 and reconcile metadata against object counts. Review staged orphan files separately; never make them public to simplify recovery.
4. Reconfigure environment secrets and redirect allowlists. Verify login/MFA and invitation/recovery with disposable accounts; provider signing keys and email configuration are not established by a PostgreSQL table restore alone.
5. Run RLS tests for read/insert/update/delete, private download tests, disabled-session tests, and workflow/idempotency tests in the restored environment.
6. Record actual results and unresolved gaps before declaring recovery operational.

If quota limits stop service, preserve the last known verified backup, pause nonessential uploads, and use the provider dashboard to assess options. Do not silently enable billing or lose historical records to free space.
