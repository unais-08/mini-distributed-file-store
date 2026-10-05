# MiniDFS frontend

The MiniDFS frontend is a Next.js control panel for exploring file placement, chunk replication, storage-node health, failures, and repair activity.

## Run locally

From this directory:

```bash
npm install
copy .env.example .env.local
npm run dev
```

The development server runs at `http://localhost:3000` by default.

The backend must be running separately, normally at `http://localhost:8080`.

## Environment variables

The frontend reads the backend API URL from `NEXT_PUBLIC_API_URL`:

```env
NEXT_PUBLIC_API_URL=http://localhost:8080/api
```

For a deployed frontend, set this to the public backend API URL before building:

```env
NEXT_PUBLIC_API_URL=https://api.example.com/api
```

Because this variable is prefixed with `NEXT_PUBLIC_`, it is included in the browser bundle. Do not put secrets in frontend environment variables.

## Available scripts

```bash
npm run dev      # Start the development server
npm run lint     # Run ESLint
npm run build    # Create a production build
npm start        # Serve the production build
```

## Production build

Set `NEXT_PUBLIC_API_URL` to the deployed backend URL, install dependencies, build the application, and start it:

```bash
npm install
npm run build
npm start
```

The deployed backend must allow the frontend origin through its `CORS_ORIGINS` configuration. For example:

```env
CORS_ORIGINS=https://app.example.com
```

## Control panel sections

- **Overview** — system metrics, upload, node health, topology, and recent activity.
- **Files & topology** — select a file and follow each chunk to its replicas and node health.
- **Storage nodes** — inspect capacity and simulate nodes going offline or online.
- **Activity** — review coordinator events, including placement, failures, and repairs.

The interface uses the backend API for all file, node, topology, and repair operations. No backend functionality is implemented in the frontend.
