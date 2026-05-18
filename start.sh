#!/usr/bin/env bash
set -euo pipefail

docker build .

# run
docker compose up --build -d --wait
curl http://localhost:8888/api/login