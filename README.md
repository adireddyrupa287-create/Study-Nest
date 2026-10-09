# AI Notes Organizer

A beginner-friendly notes app with a React/Vite frontend and a Flask REST API. Flask serves the built frontend so the first Render deployment can use one web service. User records are separated by ownership checks in every API query. Passwords are hashed, and protected API requests require a signed JWT.

## Run locally

Requirements: Node.js 20+ and Python 3.11+.

1. Copy `.env.example` to `.env` and set `JWT_SECRET_KEY` to a long random value. Keep `.env` private and never commit it.
2. Install frontend dependencies: `npm install`
3. Build the frontend: `npm run build`
4. Install API dependencies: `python -m pip install -r backend/requirements.txt`
5. Start the API and built site: `python backend/app.py`
6. Open `http://localhost:5000`. To work on the UI with hot reload, run `npm run dev` in another terminal; set `VITE_API_URL=http://localhost:5000` in a local frontend environment file if API calls need a different origin.

The local default database is SQLite. Tables are created on startup for local development. When you change a database model, create and review a migration with `py -m flask --app backend.app db migrate -m "describe your change"`, then apply it locally with `py -m flask --app backend.app db upgrade`. The Render container applies committed migrations before Gunicorn starts.

## Create your own account

Use the registration screen. There are no pre-created/demo accounts. Passwords must have at least 10 characters, including a letter and a number.

## Features included

- Register, sign in, JWT-protected account, logout.
- Create, edit, delete, favorite and search personal notes.
- Folders, tags, rich-text-like plain-text editor with write/preview views, dark mode, responsive layout.
- Private, revocable read-only share links; PDF export.
- Import PDFs with selectable text and images with browser OCR. Extracted text is reviewed in the editor before use; original files are processed in the browser and are not stored by the API.
- Speech-to-text where the browser supports Web Speech Recognition.
- AI summary, Q&A, flashcard/quiz content, tag suggestion, and category suggestion when `OPENAI_API_KEY` is configured. AI responses are provider-generated and require your own API key.

## Deploy to Render

1. Push this folder to a GitHub repository and connect the repository to Render.
2. Choose **Blueprint** and select `render.yaml`. The Dockerfile builds the React frontend with Node and runs the Flask API with Python in one container.
3. Create a Render PostgreSQL database and set its internal connection string as `DATABASE_URL` on the web service. The database is required in production because the web service's local filesystem is not durable across deploys.
4. Render generates `JWT_SECRET_KEY`. Add `OPENAI_API_KEY` only if you want AI actions.
5. Deploy and check `https://<your-service>.onrender.com/api/health`.

Required service environment values: `APP_ENV=production`, `DATABASE_URL`, and `JWT_SECRET_KEY`. `render.yaml` generates the JWT secret; Render reads `PORT` at runtime.

No live deployment has been performed from this workspace: it needs a connected Git provider, Render account, and database URL. Render configuration is prepared in `render.yaml`.

## API overview

- `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/auth/me`
- `GET|POST /api/notes`, `GET|PATCH|DELETE /api/notes/:id`
- `GET|POST /api/folders`, `PATCH|DELETE /api/folders/:id`
- `POST|DELETE /api/notes/:id/share`, `GET /api/shared/:token`
- `POST /api/notes/:id/ai/{summary|flashcards|quiz|chat|tags|category}`
- `GET /api/health`

Protected routes accept `Authorization: Bearer <access-token>`. Tokens last eight hours. The browser keeps the access token in session storage, which clears when the browser session ends; production still benefits from a strong content security policy and regular dependency updates.

## Verify

Backend checks: `python -m unittest discover -s backend/tests -v`

Frontend production build: `npm run build`

These checks validate application behavior and compilation, not the availability of external AI services or an actual Render deployment.
