#!/usr/bin/env bash
set -o errexit

npm install
npm run build

python -m pip install --upgrade pip setuptools wheel pipenv
pipenv install --python "$(command -v python3)"
pipenv run upgrade
