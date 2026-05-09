#!/usr/bin/env bash
cd "$(dirname "$0")/../frontend"
python3 -m http.server 8000
