# Product Drop

A simple demo UI that simulates a product reservation and checkout flow. No auth, no payments — just to demonstrate the reservation process.

## What it does

- Displays available products fetched from the database
- Lets a user reserve an item, which holds it for **60 seconds**
- The user must complete checkout within that window or the hold expires and the item returns to inventory
- Reservations page shows a live countdown with active holds and history

## Stack

- **Frontend** — React + Vite (no router library, just state)
- **Backend** — Node.js + Express + TypeScript
- **Database** — PostgreSQL

PostgreSQL was chosen specifically for its **transaction support**. Every reserve and checkout operation runs inside a transaction so that if anything fails halfway through (or two users try to grab the last item at the same time), the database stays consistent and inventory counts never get out of sync.

## Getting started

### 1. Set up the database

Create a PostgreSQL database and make sure you have a `products` and `reservations` table set up.

### 2. Configure the backend

Create a `.env` file inside the `backend` folder:

```
DB_HOST=xxxx
DB_PORT=xxxx
DB_USER=xxxx
DB_PASSWORD=xxxx
DB_NAME=xxxx
```

### 3. Install dependencies

In the `backend` folder:
```bash
npm install
```

In the `frontend` folder:
```bash
npm install
```

### 4. Start the app

In the `backend` folder:
```bash
npm run dev
```

In the `frontend` folder (new terminal):
```bash
npm run dev
```

Then open [http://localhost:5173](http://localhost:5173) in your browser.

Backend runs on `http://localhost:3000`.
