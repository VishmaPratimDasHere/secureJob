#!/bin/bash
# Full setup script for SecureJob Platform
# CSE 345/545 - Foundations of Computer Security

set -e
PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "=================================================="
echo "  SecureJob Platform - Setup Script"
echo "  Secure Job Search & Professional Networking"
echo "=================================================="

# Step 1: Generate SSL certificates
echo ""
echo "[1/4] Generating SSL certificates..."
bash "$PROJECT_DIR/generate_certs.sh"

# Step 2: Set up Python virtual environment and backend
echo ""
echo "[2/4] Setting up Python backend..."
python3 -m venv "$PROJECT_DIR/backend/venv"
source "$PROJECT_DIR/backend/venv/bin/activate"
pip install --upgrade pip
pip install -r "$PROJECT_DIR/backend/requirements.txt"
echo "Backend dependencies installed."

# Step 3: Set up React frontend
echo ""
echo "[3/4] Setting up React frontend..."
cd "$PROJECT_DIR/frontend"
npm install
echo "Frontend dependencies installed."

# Step 4: Configure Nginx
echo ""
echo "[4/4] Configuring Nginx..."
sudo cp "$PROJECT_DIR/nginx/securejob.conf" /etc/nginx/sites-available/securejob
sudo ln -sf /etc/nginx/sites-available/securejob /etc/nginx/sites-enabled/securejob
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl restart nginx
echo "Nginx configured and restarted."

echo ""
echo "=================================================="
echo "  Setup Complete!"
echo ""
echo "  Start backend:  cd backend && source venv/bin/activate && uvicorn app.main:app --reload --port 8000"
echo "  Start frontend: cd frontend && npm run dev"
echo "  Access app:     https://localhost"
echo "  API docs:       https://localhost/docs"
echo "=================================================="
