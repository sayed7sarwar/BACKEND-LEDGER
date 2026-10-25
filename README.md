# Backend Ledger

A Node.js REST API for user authentication, account management, and ledger-based money transfers. The project uses Express, MongoDB/Mongoose, JWT authentication, immutable ledger entries, transaction idempotency, and email notifications.

> **Project status:** This repository contains the backend API only. It does not include a frontend or a test suite yet.

## Contents

- [Features](#features)
- [Tech stack](#tech-stack)
- [Project structure](#project-structure)
- [Requirements](#requirements)
- [Installation](#installation)
- [Environment variables](#environment-variables)
- [Run the server](#run-the-server)
- [API reference](#api-reference)
- [Data models](#data-models)
- [Ledger and transaction behavior](#ledger-and-transaction-behavior)
- [Authentication](#authentication)
- [Email notifications](#email-notifications)
- [Development notes](#development-notes)
- [Scripts](#scripts)
- [License](#license)

## Features

- Register, log in, and log out users.
- Hash passwords with `bcryptjs`.
- Authenticate requests using JWTs supplied by a cookie or `Authorization: Bearer` header.
- Create user accounts and list the signed-in user's accounts.
- Calculate account balances from ledger entries (credits minus debits).
- Transfer funds between active accounts.
- Use an idempotency key to identify repeated transaction requests.
- Record debit and credit entries as immutable ledger records.
- Support a privileged system-user endpoint for initial funds.
- Send registration and transaction email notifications through Gmail OAuth2/Nodemailer.
- Store revoked JWTs in a blacklist with a three-day TTL.

## Tech stack

| Technology | Purpose |
|---|---|
| Node.js | JavaScript runtime |
| Express 5 | HTTP API and routing |
| MongoDB | Persistent data store |
| Mongoose | MongoDB models, queries, and sessions |
| JSON Web Token (`jsonwebtoken`) | Authentication tokens |
| `bcryptjs` | Password hashing and verification |
| `cookie-parser` | Reading and clearing authentication cookies |
| `dotenv` | Loading environment variables |
| Nodemailer | Email notifications |

## Project structure

```text
BACKEND-LEDGER/
├── server.js
├── package.json
├── package-lock.json
├── .gitignore
└── src/
    ├── app.js
    ├── config/
    │   └── db.js
    ├── controllers/
    │   ├── account.controller.js
    │   ├── auth.controller.js
    │   └── transaction.controller.js
    ├── middleware/
    │   └── auth.middleware.js
    ├── models/
    │   ├── account.model.js
    │   ├── blacklist.model.js
    │   ├── ledger.model.js
    │   ├── transaction.model.js
    │   └── user.model.js
    ├── routes/
    │   ├── account.routes.js
    │   ├── auth.routes.js
    │   └── transaction.routes.js
    └── services/
        └── email.service.js
```

## Requirements

Install the following before running the project:

- [Node.js](https://nodejs.org/) (a version compatible with the dependencies in `package-lock.json`)
- npm
- MongoDB database, local or hosted (for example, MongoDB Atlas)
- Gmail OAuth2 credentials if you want email notifications to work

## Installation

Clone the repository and install dependencies:

```bash
git clone https://github.com/sayed7sarwar/BACKEND-LEDGER.git
cd BACKEND-LEDGER
npm install
```

Create a `.env` file in the project root. See [Environment variables](#environment-variables).

## Environment variables

The code reads these values from `process.env`:

| Variable | Required | Description |
|---|---:|---|
| `MONGO_URI` | Yes | MongoDB connection string |
| `JWT_SECRET` | Yes | Secret used to sign and verify JWTs |
| `EMAIL_USER` | For email | Gmail account used as the sender |
| `CLIENT_ID` | For email | Google OAuth2 client ID |
| `CLIENT_SECRET` | For email | Google OAuth2 client secret |
| `REFRESH_TOKEN` | For email | Google OAuth2 refresh token |

Example `.env` (replace placeholders with your own values):

```dotenv
MONGO_URI=mongodb://127.0.0.1:27017/backend-ledger
JWT_SECRET=replace_with_a_long_random_secret

EMAIL_USER=your-gmail-address@gmail.com
CLIENT_ID=your_google_oauth_client_id
CLIENT_SECRET=your_google_oauth_client_secret
REFRESH_TOKEN=your_google_oauth_refresh_token
```

Do not commit `.env` or expose secrets in source control. Configure Gmail OAuth2 and its refresh token separately if email delivery is needed. Email sending is configured in `src/services/email.service.js`.

## Run the server

Development mode (uses Nodemon):

```bash
npm run dev
```

Production/start mode:

```bash
npm start
```

The server listens on port **3000**. The root endpoint can be checked at:

```text
GET http://localhost:3000/
```

Expected response:

```text
Ledger Service is up and running
```

The database connection is initiated from `server.js`; the app logs a successful connection when MongoDB is reachable and exits if the connection fails.

## API reference

Base URL for local development:

```text
http://localhost:3000
```

All request bodies must be JSON. Protected routes accept the JWT in either the `token` cookie or an `Authorization` header formatted as `Bearer <token>`.

### Health

| Method | Endpoint | Authentication | Description |
|---|---|---|---|
| `GET` | `/` | No | Service status |

### Authentication

| Method | Endpoint | Authentication | Description |
|---|---|---|---|
| `POST` | `/api/auth/register` | No | Register a user |
| `POST` | `/api/auth/login` | No | Log in |
| `POST` | `/api/auth/logout` | No | Revoke the current token and clear cookie |

#### Register

`POST /api/auth/register`

```json
{
  "name": "Example User",
  "email": "user@example.com",
  "password": "password123"
}
```

Successful response (`201`) includes the created user's `_id`, `email`, and `name`, plus a JWT token. The token is also set in the `token` cookie. A registration email is sent after the response is prepared.

#### Login

`POST /api/auth/login`

```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

Successful response (`200`) includes the user details and JWT token. The token is also set in the `token` cookie.

#### Logout

`POST /api/auth/logout`

Send the token in the cookie or Bearer header. The token is added to the blacklist and the cookie is cleared.

### Accounts

All account endpoints require authentication.

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/accounts/` | Create an account for the logged-in user |
| `GET` | `/api/accounts/` | List the logged-in user's accounts |
| `GET` | `/api/accounts/balance/:accountId` | Get the balance of an account owned by the logged-in user |

#### Create account

`POST /api/accounts/`

No request body is required. The account is associated with the authenticated user and defaults to `ACTIVE` status and `INR` currency.

#### List accounts

`GET /api/accounts/`

Returns the accounts belonging to the authenticated user.

#### Get account balance

`GET /api/accounts/balance/:accountId`

Example:

```text
GET /api/accounts/balance/ACCOUNT_ID
```

Response:

```json
{
  "accountId": "ACCOUNT_ID",
  "balance": 2500
}
```

The balance is calculated from ledger records; it is not stored as a mutable account balance field.

### Transactions

| Method | Endpoint | Authentication | Description |
|---|---|---|---|
| `POST` | `/api/transactions/` | User JWT | Transfer funds between accounts |
| `POST` | `/api/transactions/system/initial-funds` | System-user JWT | Create an initial-funds transaction |

#### Transfer funds

`POST /api/transactions/`

```json
{
  "fromAccount": "SENDER_ACCOUNT_ID",
  "toAccount": "RECIPIENT_ACCOUNT_ID",
  "amount": 100,
  "idempotencyKey": "unique-client-generated-key"
}
```

The request requires `fromAccount`, `toAccount`, `amount`, and `idempotencyKey`.

The controller checks that both accounts exist and are active, checks the idempotency key, and verifies the sender's ledger-derived balance. The transaction is recorded with a debit for the sender and a credit for the recipient. On successful completion, the API returns `201` and the transaction document. A successful repeat using the same key returns the existing completed transaction.

#### Initial funds

`POST /api/transactions/system/initial-funds`

This endpoint requires a JWT belonging to a user whose `systemUser` flag is true.

```json
{
  "toAccount": "RECIPIENT_ACCOUNT_ID",
  "amount": 1000,
  "idempotencyKey": "unique-initial-funds-key"
}
```

The system account is selected from the authenticated system user's account. The controller creates debit and credit ledger entries and marks the transaction completed.

> The repository does not include a public API route or setup script for creating a system user. The `systemUser` field is immutable in the user schema and excluded from normal queries by default, so provisioning must be handled securely outside the ordinary registration flow.

## Data models

### User

- `email` — required, unique, trimmed, lowercased, and validated
- `name` — required
- `password` — required, minimum six characters, stored as a bcrypt hash and excluded from ordinary queries
- `systemUser` — boolean, defaults to `false`, immutable, and excluded from ordinary queries
- timestamps — `createdAt` and `updatedAt`

### Account

- `user` — required reference to the owner
- `status` — `ACTIVE`, `FROZEN`, or `CLOSED`; defaults to `ACTIVE`
- `currency` — required, defaults to `INR`
- timestamps

### Transaction

- `fromAccount` and `toAccount` — account references
- `amount` — required, non-negative number
- `status` — `PENDING`, `COMPLETED`, `FAILED`, or `REVERSED`
- `idempotencyKey` — required and unique
- timestamps

### Ledger entry

- `account` — account reference
- `amount` — required
- `transaction` — transaction reference
- `type` — `CREDIT` or `DEBIT`

Ledger fields are marked immutable and model middleware rejects common update and delete operations. Account balance is computed as:

```text
balance = sum(CREDIT amounts) - sum(DEBIT amounts)
```

### Token blacklist

- `token` — required and unique
- timestamps
- MongoDB TTL index configured to expire blacklist records after three days

## Ledger and transaction behavior

The account balance is derived from ledger entries, making the ledger the source of truth for account balances.

For a normal transfer, the intended flow is:

1. Validate required request fields.
2. Find sender and recipient accounts.
3. Check idempotency key and prior transaction status.
4. Ensure both accounts are `ACTIVE`.
5. Calculate sender balance from the ledger and check funds.
6. Start a MongoDB session/transaction.
7. Create a `PENDING` transaction.
8. Write a sender `DEBIT` ledger entry.
9. Write a recipient `CREDIT` ledger entry.
10. Mark the transaction `COMPLETED`.
11. Commit the database transaction.
12. Send a transaction email.

MongoDB transactions require a deployment that supports sessions and transactions (typically a replica set or sharded cluster; a standalone MongoDB server does not support multi-document transactions).

## Authentication

The authentication middleware:

1. Reads the token from the `token` cookie or `Authorization: Bearer <token>`.
2. Rejects tokens present in the blacklist.
3. Verifies the JWT using `JWT_SECRET`.
4. Loads the user and attaches it to `req.user`.

Tokens are signed with a three-day expiration. The system-user middleware additionally checks the user's `systemUser` flag.

## Email notifications

`src/services/email.service.js` configures Nodemailer with Gmail OAuth2. The service contains functions for:

- Registration welcome email
- Successful transaction email
- Failed transaction email

Email delivery requires valid OAuth2 environment variables. The current transaction controller invokes the successful transaction email after completing a normal transfer. The registration controller invokes the registration email after sending the registration response.

## Development notes

- The configured port is currently hard-coded to `3000`.
- The project uses MongoDB/Mongoose sessions for transfer transactions.
- `npm test` is currently a placeholder and exits with an error because no test suite has been configured.
- The initial-funds route is privileged and should only be used by a securely provisioned system user.
- Use HTTPS and secure cookie settings when deploying in production.
- Validate positive finite transaction amounts and ownership of the sender account before processing transfers.
- Consider adding centralized error handling, request validation, rate limiting, and integration tests before production use.
- Review transaction failure handling and ensure sessions are aborted and closed when an operation fails.
- Avoid logging credentials, tokens, or passwords.

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start server with Nodemon |
| `npm start` | Start server with Node |
| `npm test` | Placeholder; tests are not implemented |

## License

This project declares the **ISC** license in `package.json`. Add a `LICENSE` file if you want the license text included in the repository.
