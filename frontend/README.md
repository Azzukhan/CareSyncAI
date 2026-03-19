# CareSync Frontend

React, TypeScript, and Vite frontend for CareSync.

## Local development

Frontend uses `VITE_API_BASE_URL` to call the backend API.

Create `frontend/.env` with:

```env
VITE_API_BASE_URL=http://127.0.0.1:8000
```

```sh
cd frontend
npm install
npm run dev
```

Start the backend separately using [backend/README.md](/Users/azzu/Documents/caresync/backend/README.md).
For the full product overview, setup flow, and feature list, use the root [README.md](/Users/azzu/Documents/caresync/README.md).

## Scripts

- `npm run dev` starts the Vite dev server
- `npm run build` creates a production build
- `npm run preview` previews the production build locally
- `npm run test` runs the Vitest suite
- `npm run lint` runs ESLint

## Stack

- React 18
- TypeScript
- Vite
- Tailwind CSS
- shadcn/ui
- Vitest
