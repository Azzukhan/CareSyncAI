# CareSync Frontend

React, TypeScript, and Vite frontend for CareSync.

## Local development

Frontend uses `VITE_API_BASE_URL` to call the backend API.

```sh
cd frontend
cp .env.example .env
npm install
npm run dev
```

Start the backend separately using [../backend/README.md](/Users/azzu/Documents/caresync/backend/README.md).

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
