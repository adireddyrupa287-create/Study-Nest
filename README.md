# Study Nest — AI Notes Organizer

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
- AI summary, Q&A, flashcard/quiz content, tag suggestion, category suggestion, and meaning-based search through Gemini, OpenAI, or Groq compatible APIs. These features require a provider API key; Gemini is the default example configuration.

## Deploy to Render with Neon

1. Push this folder to GitHub and connect the repository to Render as a Blueprint using `render.yaml`.
2. Set `DATABASE_URL` on the Render web service to the connection string for the Neon `Study Nest` project. Keep the connection string secret; do not commit it.
3. Render generates `JWT_SECRET_KEY`. To enable Gemini AI actions, add `GEMINI_API_KEY` in the Render Environment settings. The Blueprint configures `AI_PROVIDER=gemini`, `AI_MODEL=gemini-2.5-flash`, and `AI_EMBEDDING_MODEL=gemini-embedding-001`. OpenAI and Groq can also be selected with `AI_PROVIDER=openai` or `AI_PROVIDER=groq` and their corresponding provider key/model.
4. Deploy and check `https://<your-service>.onrender.com/api/health`.

Required service environment values: `APP_ENV=production`, `DATABASE_URL`, and `JWT_SECRET_KEY`. `render.yaml` generates the JWT secret; Render reads `PORT` at runtime. AI is optional; for Gemini, set `AI_PROVIDER=gemini` and `GEMINI_API_KEY`. The Docker container applies the committed Alembic migrations before Gunicorn starts.

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
