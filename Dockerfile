FROM node:22-alpine AS frontend-build
WORKDIR /project
COPY package.json package-lock.json ./
RUN npm ci
COPY index.html vite.config.js ./
COPY src ./src
RUN npm run build

FROM python:3.13.7-slim
WORKDIR /app
ENV PYTHONUNBUFFERED=1 PYTHONDONTWRITEBYTECODE=1 APP_ENV=production
COPY backend/requirements.txt ./backend/requirements.txt
RUN pip install --no-cache-dir -r backend/requirements.txt
COPY backend ./backend
COPY --from=frontend-build /project/backend/static ./backend/static
EXPOSE 10000
CMD ["sh", "-c", "flask --app backend.app db upgrade && gunicorn --preload --chdir backend app:app --bind 0.0.0.0:${PORT:-10000} --workers 2 --timeout 120"]
