# Production Docker Deployment

## Goal

`docker-compose.prod.yml` is intended for production-style deployments with:

- PostgreSQL reachable only through Docker internal networking
- secrets provided through mounted files instead of inline compose values
- public origins and operational limits configured through a dedicated env file

## Files

- `docker-compose.prod.yml`
- `.env.production.example`
- `secrets/examples/*.example.txt`

## Recommended setup

1. Copy `.env.production.example` to `.env.production`.
2. Create a private secret directory such as `secrets/prod/`.
3. Create the real secret files:
   - `postgres_password.txt`
   - `database_url.txt`
   - `jwt_access_secret.txt`
   - `jwt_refresh_secret.txt`
   - `smtp_password.txt`
4. Update `.env.production` so each `*_SECRET_FILE` variable points to the real files.
5. Review `NUCARE_PUBLIC_APP_ORIGIN`, `NUCARE_PUBLIC_API_ORIGIN`, SMTP settings, and rate-limit values.

## Start command

```powershell
docker compose --env-file .env.production -f docker-compose.prod.yml up -d --build
```

## Security notes

- Do not keep real secrets in `docker-compose.prod.yml`.
- Do not commit `.env.production` or any real files under `secrets/prod/`.
- The database service is attached only to the internal backend network and has no published host port.
- The server container reads sensitive values through `*_FILE` variables, which allows Docker-mounted secret files to be used without exposing values inline in compose.
- In plain Docker Compose, these secrets are mounted from files on the host. For a stronger enterprise posture, use a managed secret store or orchestrator-native secret system in the real production environment.
