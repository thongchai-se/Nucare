# Secrets Directory

This directory is reserved for local secret files used by `docker-compose.prod.yml`.

Recommended production practice:

1. Create a private directory such as `secrets/prod/`.
2. Store one secret per file.
3. Point `.env.production` to those files.
4. Do not commit real secret files into git.

Required production secret files:

- `postgres_password.txt`
- `database_url.txt`
- `jwt_access_secret.txt`
- `jwt_refresh_secret.txt`
- `smtp_password.txt`

Example files are provided in `secrets/examples/` for local validation and documentation only.
