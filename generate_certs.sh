#!/bin/bash
# Generate self-signed SSL certificates for SecureJob Platform
# CSE 345/545 - Foundations of Computer Security

CERT_DIR="$(dirname "$0")/certs"
mkdir -p "$CERT_DIR"

echo "=================================================="
echo "  Generating Self-Signed SSL Certificate"
echo "  SecureJob Platform - FCS Project"
echo "=================================================="

openssl req -x509 -nodes \
    -days 365 \
    -newkey rsa:2048 \
    -keyout "$CERT_DIR/securejob.key" \
    -out "$CERT_DIR/securejob.crt" \
    -subj "/C=IN/ST=State/L=City/O=SecureJob/OU=FCS-Project/CN=localhost" \
    -addext "subjectAltName=DNS:localhost,IP:127.0.0.1"

echo ""
echo "Certificates generated successfully!"
echo "  Certificate: $CERT_DIR/securejob.crt"
echo "  Private Key: $CERT_DIR/securejob.key"
echo ""
echo "Certificate details:"
openssl x509 -in "$CERT_DIR/securejob.crt" -noout -subject -dates -issuer
echo "=================================================="
