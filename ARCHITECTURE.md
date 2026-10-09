# AI Notes Organizer architecture

## Stack

- **Frontend:** React with Vite, JavaScript, and CSS. The interface is a responsive single-page application.
- **Backend:** Python Flask REST API.
- **Authentication:** signed JWT access tokens with an eight-hour lifetime. The browser stores the token in session storage and sends it as a Bearer token.
- **Database:** SQLAlchemy models use PostgreSQL in production and SQLite for local setup. The service refuses to start in production without `DATABASE_URL` and a 32-character `JWT_SECRET_KEY`.
- **AI:** OpenAI calls run only in Flask, and require `OPENAI_API_KEY`. AI is optional; core notes features work without it.
- **Deployment:** one Render Docker web service. A Node build stage compiles React; a Python stage runs Flask with Gunicorn. A separate persistent Render PostgreSQL database is required.

## Data model

- `User`: name, unique email, password hash.
- `Folder`: owner, name, color.
- `Tag`: owner, name; unique per owner.
- `Note`: owner, title, Markdown/plain-text content, summary, folder, tags, color, favorite flag, timestamps, and optional share-token hash.
- Notes and folders are queried with the authenticated user's ID. Tags are created and attached within that same owner scope. A share token is random and its SHA-256 hash is stored; share links are read-only and revocable.

## Screens

- Register and login.
- Dashboard with recent notes, folders, quick capture, and study actions.
- Notes library with keyword/tag filtering, optional AI meaning search, and note cards.
- Note editor with Markdown formatting, preview, folder/tag controls, study actions, voice input, PDF export, and share controls.
- Notes-wide chatbot, study toolkit, and read-only shared-note page.

## API groups

- `/api/auth/*`: register, login, current user.
- `/api/notes`: list, create, read, update, delete.
- `/api/folders`: list, create, rename, delete.
- `/api/notes/:id/share` and `/api/shared/:token`: issue/revoke and read an explicit share link.
- `/api/notes/:id/ai/:kind` and `/api/chat`: note-level study tools and notes-wide Q&A.
- `/api/notes/:id/duplicates` and `/api/search/semantic`: private duplicate suggestions and embedding-based search.
- `/api/health`: Render health check.

## AI, import, and privacy notes

- PDF text extraction and image OCR run in the browser; extracted text is shown in an editable note. Original PDF/image binaries are not uploaded or retained by this version.
- Semantic search sends a user's query and up to 100 of their recent notes to the embedding API per search. The API filters notes by account before sending context. This is a simple starter approach; a larger application should persist embeddings and use PostgreSQL pgvector.
- The notes-wide chatbot uses up to the 20 most recently updated text notes and names those sources in its answer. Note text is treated as reference material, never as instructions.
- Generated summaries are saved to the note. Study cards and quiz questions are schema-shaped by prompt and rendered as interactive review controls; the provider may still return malformed output, which is displayed as text rather than executed.
- Duplicate detection compares normalized word sets among the current user's notes and suggests matches; it does not delete content.

## Build stages

1. Registration/login and authenticated API checks.
2. Notes, editor, folders, tags, search, and dashboard.
3. Responsive styling, keyboard shortcuts, and dark mode.
4. PDF/image text extraction, voice input, and PDF export.
5. AI summaries, tags/categories, study sets, chatbot, and semantic search.
6. Private sharing, duplicate suggestions, Render PostgreSQL configuration, and release checks.

The working implementation and checks are summarized in `README.md`. No Render deployment has been run from this workspace; Render needs a connected Git repository and a configured PostgreSQL database.
