#!/bin/zsh
cd -- "$(dirname -- "$0")"
exec /usr/bin/env python3 scripts/servir_visor.py
