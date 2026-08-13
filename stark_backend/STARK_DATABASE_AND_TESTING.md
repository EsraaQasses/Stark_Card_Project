# Stark Backend: PostgreSQL and Testing Guide

## Current database setup

The Stark backend is configured to use local PostgreSQL for both development and tests.

| Setting | Value |
|---|---|
| Database engine | PostgreSQL |
| PostgreSQL version | 18.4 |
| Host | `127.0.0.1` |
| Port | `5432` |
| Database | `stark_card` |
| User | `postgres` |
| SSL mode | `disable` for local development only |

The configuration is stored in the local-only files:

- `.env.local` for development
- `.env.test` for tests

The real database password is intentionally not stored in this document. It must remain in `.env.local` / `.env.test` or in a secret manager. Never commit those files or paste the password into source control, documentation, logs, Postman collections, or chat.

## How PostgreSQL works with Django

1. PostgreSQL runs locally on port `5432`.
2. Django reads `DJANGO_ENV` and loads the matching environment file.
3. `USE_SQLITE=0` selects PostgreSQL.
4. Django connects to the `stark_card` database using the configured PostgreSQL credentials.
5. `python manage.py migrate` applies migration files to PostgreSQL.
6. Tests use a temporary PostgreSQL test database derived from the configured database name.

Check the active backend:

```powershell
cd E:\Stark-card_Server\stark_backend
$env:DJANGO_ENV = "development"
python -c "import os; os.environ['DJANGO_SETTINGS_MODULE']='stark_backend.settings'; import django; django.setup(); from django.conf import settings; from django.db import connection; print(settings.DATABASES['default']['ENGINE']); connection.ensure_connection(); print(connection.vendor)"
```

## Start PostgreSQL if it is stopped

PostgreSQL data directory:

```text
C:\Users\M S I\postgresql-data\stark-card
```

Start it with:

```powershell
$pg = "C:\Users\M S I\scoop\apps\postgresql\current\bin"
& "$pg\pg_ctl.exe" start `
  -D "C:\Users\M S I\postgresql-data\stark-card" `
  -l "C:\Users\M S I\postgresql-data\stark-card\server.log" `
  -w
```

Check it:

```powershell
& "$pg\pg_isready.exe" -h 127.0.0.1 -p 5432 -U postgres
```

## Migration status

The PostgreSQL `stark_card` database currently has all application migrations applied, including:

```text
third_party_apis.0004_wawp_configuration
```

Verified results:

- Applied migrations: 122
- Pending migrations: none
- `makemigrations --check --dry-run`: no changes
- `python manage.py check --database default`: passed

Verify again:

```powershell
$env:DJANGO_ENV = "development"
python manage.py showmigrations
python manage.py makemigrations --check --dry-run
python manage.py check --database default
```

## Backups

Backups created before switching the project to PostgreSQL:

```text
E:\Stark-card_Server\backups\postgres-migration-20260813-173903
```

This contains:

- `db.sqlite3` — previous SQLite database
- `stark_card.dump` — PostgreSQL custom-format dump

## Run the backend

```powershell
cd E:\Stark-card_Server\stark_backend
$env:DJANGO_ENV = "development"
python manage.py runserver 127.0.0.1:8000
```

Useful endpoints:

```text
OpenAPI schema: http://127.0.0.1:8000/api/schema/
Admin:          http://127.0.0.1:8000/admin/
Register:       http://127.0.0.1:8000/api/users/register/
Login:          http://127.0.0.1:8000/api/users/login/
Profile:        http://127.0.0.1:8000/api/users/me/
Wallets:        http://127.0.0.1:8000/api/wallets/
```

## Real local API scenarios

Run these only against local development data, never production.

### 1. API and schema availability

```powershell
Invoke-WebRequest http://127.0.0.1:8000/api/schema/ -UseBasicParsing
```

Expected result: HTTP `200` and an OpenAPI document beginning with version `3`.

### 2. Anonymous access protection

```powershell
Invoke-WebRequest http://127.0.0.1:8000/api/users/me/ -UseBasicParsing
```

Expected result: HTTP `401` because the endpoint requires authentication.

### 3. Registration

Use a unique test name, email, and phone. The registration endpoint creates an inactive account and normally requires OTP verification before login.

```powershell
$body = @{
  full_name = "Local API Test"
  name = "local_api_test_001"
  email = "local_api_test_001@example.test"
  phone = "09990000001"
  password = "LocalTestPassword123!"
  country = "SY"
  optional_phone = ""
  role = "user"
  provider = "email"
} | ConvertTo-Json

Invoke-RestMethod http://127.0.0.1:8000/api/users/register/ `
  -Method Post -ContentType "application/json" -Body $body
```

Expected result: HTTP `201`, with a registration message and user information. Do not use a real person’s email or phone for this test.

### 4. Invalid login

```powershell
$body = @{name="local_api_test_001"; password="wrong-password"} | ConvertTo-Json
Invoke-WebRequest http://127.0.0.1:8000/api/users/login/ `
  -Method Post -ContentType "application/json" -Body $body
```

Expected result: HTTP `400` or `401`, with no access token.

### 5. Django and database smoke checks

```powershell
$env:DJANGO_ENV = "development"
python manage.py check --database default
python manage.py showmigrations | Select-String "\[ \]"
python manage.py test finance.tests.FinanceCharacterizationTests --verbosity 1
```

Expected result: system check passes, no pending migrations are printed, and the finance tests pass.

## Rollback reference

Do not delete the SQLite backup or PostgreSQL dump until PostgreSQL has been used successfully for a while.

To temporarily use SQLite for local recovery, change only the local environment setting:

```text
USE_SQLITE=1
```

Then restart Django. This does not alter PostgreSQL data.
