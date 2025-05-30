# 🛡️ Wards

Wards is a block indexer and payout automation tool designed for Waves blockchain validators.  
It calculates and assists in performing leasing payouts to lessors proportionally to their stakes.

Wards supports:

- ✅ Profiling for multiple validator instances and environments.
- ✅ Running as a **NestJS service** with REST API & Swagger UI.
- ✅ Running as a **CLI tool** for manual and automated operations.

## 🚀 Features

- Index blocks produced by your validator.
- Calculate lessor rewards proportionally.
- Track and manage payment debts.
- Generate mass transfer transactions for payouts.
- Support for multiple profiles/validators.
- REST API for automation with Swagger documentation.
- CLI interface for quick commands and scripting.

## 🛠️ Technologies Used

- **NestJS** — Application framework.
- **TypeORM** — Database ORM.
- **better-sqlite3** — Embedded SQLite database.
- **Winston + nest-winston** — Structured logging.
- **Commander.js** — CLI command handling.
- **Swagger** — API documentation.

## 📦 Installation

### Prerequisites

- **Node.js** v20+
- **npm** v9+

### Install dependencies

```bash
npm install
```

### Configure environment variables

Copy the example environment file and adjust it for your configuration:

```bash
cp .env.example .env
```

Edit `.env` to match your validator and environment settings.

### 🧩 Profiling & Multi-Instance

Run different instances of Wards for different validators or environments using profiles.

> **Note:** Profiling is an optional feature that allows you to run separate instances of Wards for different
> validators  
> or environments.  
> You can specify a profile by setting the `PROFILE` environment variable. This will load configuration from the  
> corresponding `.env.<profile>` file.
>
> Example:
> - `.env.validator1` for PROFILE=validator1
> - `.env.validator2` for PROFILE=validator2
>
> To create a profile-specific environment file, copy and modify the provided `.env.example`:
> ```bash
> cp .env.example .env.validator1
> ```
> ⚠️ In the following examples, `PROFILE=validator1` is used for clarity and demonstration.  
> Setting a profile is **Optional** — if not specified, the default `.env` file will be used

### Run database migrations (initial setup):

```bash
PROFILE=validator1 npm run migrations:run
```

This will create the required database tables in an SQLite file named `wards.sqlite`.  
For example, with `PROFILE=validator1`, the file will be `wards-validator1.sqlite`.

## 🏁 Quick Start

### Run as REST API (NestJS service):

```bash
PROFILE=validator1 npm run start
```

API available at: `http://localhost:3000`  
Swagger UI: `http://localhost:3000/api`

### Run as CLI:

```bash
PROFILE=validator1 npm run cli:config -- view
```

## 📝 Workflow

### 1. Initialize the first block (once)

```bash
PROFILE=validator1 npm run cli:indexer -- init --from 123456
```

> This command should be executed **once** at the very beginning to set the initial block height for indexing.  
> It defines the starting point for all subsequent indexing operations.

### 2. Start indexing (background process)

```bash
PROFILE=validator1 npm run cli:indexer -- index --to 124000
```

> The `--to` parameter is optional. If specified, indexing will stop at the given block height.

### 3. Reindex (optional, also background process)

```bash
PROFILE=validator1 npm run cli:indexer -- reindex --from 123000 --to 124000
```

> The `--to` parameter is optional. If specified, reindexing will stop at the given block height.
>
> ⚠️ Reindexing will **delete all indexed data starting from the specified `from` block height**, including blocks,
> leases, payments, and related state.  
> It will then reindex the range from `from` up to `to` (or to the latest block if `--to` is not specified).

### 4. Get summary

```bash
PROFILE=validator1 npm run cli:payments -- summary --output summary.json
```

> The `--output` parameter is optional. If specified, the summary will be saved to the given file as JSON.

### 5. Generate payout transactions

```bash
PROFILE=validator1 npm run cli:payments -- create-txs --file summary.json --output txs.json
```

> The addresses and amounts for transactions will be read from the `debt` field of the provided JSON file.
>
> The `--output` parameter is optional. If specified, the generated transactions will be saved to the given file as
> JSON.  
> Otherwise, they will be displayed in the console.

Or auto-fill from summary:

```bash
PROFILE=validator1 npm run cli:payments -- create-txs --output txs.json
```

> The `--output` parameter is optional. If specified, the generated transactions will be saved to the given file as
> JSON.  
> Otherwise, they will be displayed in the console.

### 6. Sign and send payout transactions

```bash
PROFILE=validator1 npm run cli:payments -- sign-and-send-txs --file txs.json --output send-result.json
```

> The `--output` parameter is optional. If specified, the result of sending transactions will be saved to the given file
> as JSON.  
> Otherwise, they will be displayed in the console.

> ⚠️ After sending payout transactions, it is recommended to perform another indexing step.  
> This ensures that the sent payments are properly indexed and reflected in the updated summary.  
> Use the same indexing command as in **step 2**.
> 
> ⚠️ **Note:** that indexing processes data up to the current block minus the configured confirmations.  
> Therefore, make sure to wait until the sent transactions have enough confirmations before starting the reindexing process.

## 📊 API Endpoints Example

- `/config` — View config.
- `/indexer/init` — Init from block.
- `/indexer/status` — View a background indexing process.
- `/indexer/start` — Start indexing.
- `/indexer/reindex` — Reindex range.
- `/payments-payable/summary` — Get debt summary.
- `/payments-payable/create-txs` — Generate transactions.
- `/payments-payable/sign-and-send-txs` — Sign and send transactions.
- Full Swagger: `/api`.

## ✅ Scripts Reference

| Command                                                               | Description                                         |
|-----------------------------------------------------------------------|-----------------------------------------------------|
| `migrations:run`                                                      | Run DB migrations                                   |
| `start`                                                               | Start NestJS API                                    |
| `cli:config -- view`                                                  | View config                                         |
| `cli:indexer -- init --from <block>`                                  | Initialize from block (once)                        |
| `cli:indexer -- index --to <block>`                                   | Start indexing                                      |
| `cli:indexer -- reindex --from <block> --to <block>`                  | Reindex (delete and reindex)                        |
| `cli:payments -- summary --output <file>`                             | Get summary (optional save to file)                 |
| `cli:payments -- create-txs --file <file> --output <file_2>`          | Generate payout transactions (from file or summary) |
| `cli:payments -- sign-and-send-txs --file <file_2> --output <file_3>` | Sign and send payout transactions                   |

## 📄 License

MIT License
