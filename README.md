# FlowForge

Multi-tenant workflow orchestration engine. Self-hosted blend of Zapier + GitHub Actions.

## Stack
- **Backend**: TypeScript, Node.js 20, Fastify
- **Frontend**: React, Vite
- **DB**: PostgreSQL 15 (jsonb + partitioned logs)
- **Cache/Broker**: Redis 7 (Streams)
- **Auth**: JWT (HS256) + Argon2id

## Quick Start

```bash
# 1. Clone
git clone <repo>
cd flowforge

# 2. Bootstrap
cp backend/.env.example backend/.env
docker compose up --build -d

# 3. Wait for migrations (~30s)
docker compose logs -f migrate

# 4. Seed dev data
pnpm seed
# Output: tenant=acme, email=admin@acme.com, password=password123

# 5. Login
open http://localhost:5173
```

## Login & Usage Guide

### 1. Logging In
Once the services are up and running, open [http://localhost:5173](http://localhost:5173) in your browser. You will be greeted by the login page:

Fill in the credentials as follows:
- **Organization Slug:** `acme`
- **Email:** `admin@acme.com`
- **Password:** `password123`

### 2. Creating and Editing Workflows
After logging in, you will see the dashboard with your workflows:

To create a new workflow:
1. Click **+ Create Workflow** on the workflows list page.
2. Click **Edit Definition** to open the side-by-side JSON editor and Topological DAG view.
3. Edit the workflow steps array to define your desired flow. For example, to add a delay node after the start step, write:
   ```json
   {
     "name": "My Workflow",
     "timeout_sec": 60,
     "steps": [
       {
         "id": "start",
         "type": "HTTP",
         "depends_on": [],
         "config": {
           "url": "https://httpbin.org/get",
           "method": "GET"
         },
         "continue_on_failure": false
       },
       {
         "id": "delay_step",
         "type": "DELAY",
         "depends_on": ["start"],
         "config": {
           "duration_ms": 2000
         },
         "continue_on_failure": false
       }
     ]
   }
   ```
  Contoh 1: Workflow HTTP Request
  ```json
  {
    "name": "HTTP Request Test",
    "timeout_sec": 60,
    "steps": [
      {
        "id": "fetch_todo",
        "type": "HTTP",
        "depends_on": [],
        "config": {
          "method": "GET",
          "url": "https://jsonplaceholder.typicode.com/todos/1"
        },
        "continue_on_failure": false
      }
    ]
  }
  ```
  Contoh 2: Workflow Menjalankan Javascript (SCRIPT)
  ```json
  {
    "name": "Javascript Execution Test",
    "timeout_sec": 60,
    "steps": [
      {
        "id": "run_math",
        "type": "SCRIPT",
        "depends_on": [],
        "config": {
          "language": "javascript",
          "code": "const a = 5; const b = 10; console.log(JSON.stringify({ result: a * b }));"
        },
        "continue_on_failure": false
      }
    ]
  }
  ```
  Contoh 3: Gabungan Kompleks (HTTP + DELAY + SCRIPT + CONDITIONAL)
  ```json
  {
    "name": "Complex Multi-Step Workflow",
    "timeout_sec": 60,
    "steps": [
      {
        "id": "call_api",
        "type": "HTTP",
        "depends_on": [],
        "config": {
          "method": "GET",
          "url": "https://jsonplaceholder.typicode.com/todos/1"
        },
        "continue_on_failure": false
      },
      {
        "id": "short_delay",
        "type": "DELAY",
        "depends_on": ["call_api"],
        "config": {
          "duration_ms": 1000
        },
        "continue_on_failure": false
      },
      {
        "id": "execute_code",
        "type": "SCRIPT",
        "depends_on": ["short_delay"],
        "config": {
          "language": "javascript",
          "code": "console.log('Script executed after delay.')"
        },
        "continue_on_failure": false
      },
      {
        "id": "verify_status",
        "type": "CONDITIONAL",
        "depends_on": ["call_api"],
        "config": {
          "expr": "input.call_api.status == 200"
        },
        "continue_on_failure": false
      }
    ]
  }
  ```
  Contoh 4: Workflow Menggunakan AI untuk Klasifikasi Teks
  ```json
  {
    "name": "AI Text Classifier",
    "timeout_sec": 60,
    "steps": [
      {
        "id": "analyze_sentiment",
        "type": "AI",
        "depends_on": [],
        "config": {
          "provider": "ollama",
          "model": "llama3",
          "prompt": "Classify the sentiment of this text: {{input.text}}",
          "input_vars": ["text"]
        },
        "continue_on_failure": false
      }
    ]
  }
  ```
4. Click **Save Draft** to submit the definition to the server.
5. Click **Trigger Run** to execute the workflow and watch the execution logs and DAG state transition live in real time.

## Folder Structure

```
packages/
  api/          REST API (Fastify)
  orchestrator/ DAG state machine
  worker/       Step executor
  scheduler/    Cron evaluator
  realtime/     WebSocket hub
  parser/       DAG validation + serializer
  auth/         JWT + RBAC + rate limit
  shared/       DB, broker, types
  web/          React dashboard (frontend/ folder)
docs/           Architecture, trade-offs, security notes
migrations/     SQL migrations
```

## Development

```bash
pnpm install
docker compose up -d postgres redis
pnpm migrate:up
pnpm seed
pnpm dev:all   # all services with hot reload
```

## Testing

```bash
pnpm test              # all unit + integration tests
pnpm test:coverage     # with coverage report
pnpm -F @flowforge/parser test  # one package
```

## Documentation

- [Architecture](docs/ARCHITECTURE.md)
- [Trade-offs](docs/TRADEOFFS.md)
- [REVIEW.md exercise](REVIEW.md)

## Known Limitations (MVP)

- Single-replica orchestrator (no partitioning)
- Script sandbox via child_process only (NOT production-safe)
- Webhook secret stored as plaintext in DB
- HS256 JWT (consider RS256 for production)

See [TRADEOFFS.md](docs/TRADEOFFS.md) for the full list.

## License

MIT
