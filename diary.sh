#!/usr/bin/env bash

# Quick terminal diary entry pusher
# Usage: ./diary.sh "Title" "Content" [Mood] [Tags] [Visibility]

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$DIR"

node scripts/publish.js "$@"
