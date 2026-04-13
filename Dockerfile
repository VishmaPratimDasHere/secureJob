# --- Stage 1: Build Frontend ---
FROM --platform=linux/amd64 node:18-bullseye AS frontend-build
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install --cpu=x64 --os=linux
COPY frontend/ ./
RUN npm run build

# --- Stage 2: Setup Backend & Nginx ---
FROM --platform=linux/amd64 python:3.11-slim-bullseye
WORKDIR /app

# Install Nginx and OpenSSL
RUN apt-get update && apt-get install -y nginx openssl && rm -rf /var/lib/apt/lists/*

# Copy Backend files and install requirements
COPY backend/requirements.txt ./backend/
RUN pip install --no-cache-dir -r backend/requirements.txt
COPY backend/ ./backend/

# Copy Frontend build from Stage 1 to Nginx web root
COPY --from=frontend-build /app/frontend/dist /var/www/html

# Copy Nginx config and SSL generation script
COPY nginx/securejob.conf /etc/nginx/sites-available/securejob
RUN ln -s /etc/nginx/sites-available/securejob /etc/nginx/sites-enabled/securejob \
    && rm /etc/nginx/sites-enabled/default
COPY generate_certs.sh ./
RUN bash generate_certs.sh

# Expose ports
EXPOSE 80 443 8000

# Start Script (Instead of systemctl which doesn't work in standard Docker)
CMD nginx && cd backend && uvicorn app.main:app --host 0.0.0.0 --port 8000