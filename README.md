# WebVault

Save & organize your favorite websites — now with a real backend (Node.js + Express + MongoDB) instead of localStorage.

## Structure
```
webvault/
├── backend/
│   ├── models/Website.js
│   ├── routes/websites.js
│   ├── server.js
│   ├── package.json
│   └── .env.example
└── frontend/
    ├── index.html
    ├── style.css
    └── script.js
```

## Backend setup

1. Make sure MongoDB is running locally (or use a MongoDB Atlas URI).
2. In `backend/`:
   ```bash
   cd backend
   npm install
   cp .env.example .env
   # edit .env if your Mongo URI / port differ
   npm run dev      # or: npm start
   ```
3. API will run at `http://localhost:5000`.

## Frontend setup

The frontend is plain HTML/CSS/JS — no build step needed.

1. Open `frontend/index.html` in a browser (or serve it with any static server, e.g. `npx serve frontend`).
2. `script.js` talks to the backend at `http://localhost:5000/api/websites` by default. Change the `API_BASE` constant at the top of `script.js` if your backend runs elsewhere.

## API endpoints

| Method | Endpoint                     | Description             |
|--------|-------------------------------|--------------------------|
| GET    | /api/websites                 | List all websites       |
| POST   | /api/websites                 | Add a website            |
| PUT    | /api/websites/:id             | Edit title/url/category/notes |
| PATCH  | /api/websites/:id/fav         | Toggle favorite          |
| PATCH  | /api/websites/:id/visit       | Increment visit count    |
| DELETE | /api/websites/:id             | Delete a website         |

## Notes

- Theme preference (dark/light) still lives in `localStorage` on purpose — it's a UI-only setting, not app data.
- CORS is open (`cors()`) for easy local dev. Lock it down before deploying.
