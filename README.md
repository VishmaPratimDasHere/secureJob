# SecureJob - Secure Job Search & Professional Networking Platform

CSE 345/545 Foundations of Computer Security — Course Project

## Technology Stack

| Layer        | Technology         |
|--------------|--------------------|
| OS           | Ubuntu / Windows   |
| Backend      | FastAPI (Python)   |
| Frontend     | React 18 (Vite)   |
| Database     | PostgreSQL         |
| Web Server   | Nginx              |
| SSL/TLS      | OpenSSL (self-signed certificate) |

## Prerequisites

- Python 3.10+
- Node.js 18+
- PostgreSQL 14+
- Nginx
- OpenSSL
- Git

---

## Setup on Ubuntu

### 1. Install system packages

```bash
sudo apt-get update -y
sudo apt-get install -y python3-pip python3-venv python3-dev libpq-dev \
    postgresql postgresql-contrib nginx nodejs npm curl openssl
```

### 2. Start and configure PostgreSQL

```bash
sudo systemctl start postgresql
sudo systemctl enable postgresql
sudo -u postgres psql -c "CREATE USER fcs_user WITH PASSWORD 'fcs_secure_2026';"
sudo -u postgres psql -c "CREATE DATABASE securejob OWNER fcs_user;"
sudo -u postgres psql -c "ALTER USER fcs_user CREATEDB;"
```

### 3. Generate self-signed SSL certificate

```bash
cd securejob
bash generate_certs.sh
```

### 4. Set up the backend

```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
```

### 5. Set up the frontend

```bash
cd frontend
npm install
```

### 6. Configure Nginx

```bash
sudo cp nginx/securejob.conf /etc/nginx/sites-available/securejob
sudo ln -sf /etc/nginx/sites-available/securejob /etc/nginx/sites-enabled/securejob
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl restart nginx
```

### 7. Run the application

Start backend and frontend in separate terminals:

```bash
# Terminal 1 — Backend
cd backend
source venv/bin/activate
uvicorn app.main:app --reload --port 8000

# Terminal 2 — Frontend
cd frontend
npm run dev
```

### 8. Access the application

| URL                          | Description              |
|------------------------------|--------------------------|
| https://localhost             | React frontend via Nginx |
| https://localhost/docs        | FastAPI Swagger UI       |
| https://localhost/api/        | Backend API              |

> Firefox will show a self-signed certificate warning. Click **Advanced → Accept the Risk and Continue**.

---

## Setup on Windows

### 1. Install prerequisites

Download and install the following:

- **Python 3.10+** — https://www.python.org/downloads/ (check "Add to PATH" during install)
- **Node.js 18+** — https://nodejs.org/ (LTS version, includes npm)
- **PostgreSQL 14+** — https://www.postgresql.org/download/windows/ (remember the password you set for the `postgres` user)
- **Nginx** — https://nginx.org/en/download.html (download the Windows zip)
- **OpenSSL** — https://slproweb.com/products/Win32OpenSSL.html (Win64 Light version)
- **Git** — https://git-scm.com/download/win

### 2. Configure PostgreSQL

Open **pgAdmin** or **SQL Shell (psql)** that comes with PostgreSQL and run:

```sql
CREATE USER fcs_user WITH PASSWORD 'fcs_secure_2026';
CREATE DATABASE securejob OWNER fcs_user;
ALTER USER fcs_user CREATEDB;
```

### 3. Generate self-signed SSL certificate

Open **Command Prompt** or **PowerShell** and run:

```powershell
cd securejob\certs
openssl req -x509 -nodes -days 365 -newkey rsa:2048 ^
    -keyout securejob.key ^
    -out securejob.crt ^
    -subj "/C=IN/ST=State/L=City/O=SecureJob/OU=FCS-Project/CN=localhost" ^
    -addext "subjectAltName=DNS:localhost,IP:127.0.0.1"
```

### 4. Set up the backend

```powershell
cd backend
python -m venv venv
venv\Scripts\activate
pip install --upgrade pip
pip install -r requirements.txt
```

### 5. Set up the frontend

```powershell
cd frontend
npm install
```

### 6. Configure Nginx

1. Extract the downloaded Nginx zip to a folder (e.g. `C:\nginx`).
2. Open `C:\nginx\conf\nginx.conf` in a text editor and replace its contents with:

```nginx
worker_processes 1;

events {
    worker_connections 1024;
}

http {
    include       mime.types;
    default_type  application/octet-stream;
    sendfile      on;

    # Redirect HTTP to HTTPS
    server {
        listen 80;
        server_name localhost;
        return 301 https://$host$request_uri;
    }

    # HTTPS server
    server {
        listen 443 ssl;
        server_name localhost;

        ssl_certificate     C:/path/to/securejob/certs/securejob.crt;
        ssl_certificate_key C:/path/to/securejob/certs/securejob.key;

        ssl_protocols TLSv1.2 TLSv1.3;
        ssl_ciphers HIGH:!aNULL:!MD5;

        add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
        add_header X-Content-Type-Options "nosniff" always;
        add_header X-Frame-Options "DENY" always;

        location / {
            proxy_pass http://127.0.0.1:3000;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-Proto $scheme;
        }

        location /api/ {
            proxy_pass http://127.0.0.1:8000;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-Proto $scheme;
        }

        location /docs {
            proxy_pass http://127.0.0.1:8000;
            proxy_set_header Host $host;
        }

        location /openapi.json {
            proxy_pass http://127.0.0.1:8000;
            proxy_set_header Host $host;
        }
    }
}
```

> **Important:** Replace `C:/path/to/securejob/certs/` with the actual path to your certs folder. Use forward slashes `/` in the path.

3. Start Nginx:

```powershell
cd C:\nginx
nginx.exe
```

### 7. Run the application

Open two separate terminals:

```powershell
# Terminal 1 — Backend
cd backend
venv\Scripts\activate
uvicorn app.main:app --reload --port 8000

# Terminal 2 — Frontend
cd frontend
npm run dev
```

### 8. Access the application

Same URLs as Ubuntu:

| URL                          | Description              |
|------------------------------|--------------------------|
| https://localhost             | React frontend via Nginx |
| https://localhost/docs        | FastAPI Swagger UI       |
| https://localhost/api/        | Backend API              |

---

## Key Differences: Ubuntu vs Windows

| Step                  | Ubuntu                                      | Windows                                   |
|-----------------------|---------------------------------------------|-------------------------------------------|
| Package install       | `apt-get install`                           | Manual download + installer               |
| Python venv activate  | `source venv/bin/activate`                  | `venv\Scripts\activate`                   |
| PostgreSQL setup      | `sudo -u postgres psql`                     | pgAdmin or SQL Shell (psql)               |
| Nginx config path     | `/etc/nginx/sites-available/`               | `C:\nginx\conf\nginx.conf`               |
| Nginx control         | `sudo systemctl restart nginx`              | `nginx.exe` / `nginx.exe -s reload`       |
| SSL cert generation   | `bash generate_certs.sh`                    | `openssl` command in PowerShell           |
| Cert paths in config  | Absolute Linux paths `/home/...`            | Windows paths with forward slashes `C:/...` |

## Project Structure

```
securejob/
├── backend/
│   ├── app/
│   │   ├── main.py                ← FastAPI entry point
│   │   ├── core/
│   │   │   ├── config.py          ← Settings (DB, JWT, CORS)
│   │   │   ├── database.py        ← SQLAlchemy + PostgreSQL
│   │   │   └── security.py        ← Argon2 hashing, JWT tokens
│   │   ├── models/
│   │   │   ├── user.py            ← User model (RBAC roles)
│   │   │   └── job.py             ← Company, JobPosting, Application
│   │   ├── schemas/
│   │   │   ├── user.py            ← Pydantic request/response schemas
│   │   │   └── job.py
│   │   └── routers/
│   │       ├── accounts.py        ← Register, Login, Users API
│   │       ├── jobs.py            ← Jobs & Companies API
│   │       └── messaging.py       ← Messaging (placeholder)
│   └── requirements.txt
├── frontend/
│   ├── package.json
│   ├── vite.config.js
│   ├── index.html
│   └── src/
│       ├── main.jsx
│       ├── index.css
│       └── App.jsx                ← Landing page with status dashboard
├── nginx/
│   └── securejob.conf             ← Nginx HTTPS config (Ubuntu)
├── certs/
│   ├── securejob.crt              ← Self-signed SSL certificate
│   └── securejob.key              ← Private key
├── screenshots/                   ← Report screenshots
├── generate_certs.sh              ← SSL cert generation script
├── setup.sh                       ← Full setup script (Ubuntu)
└── README.md
```
