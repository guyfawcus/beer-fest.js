#!/usr/bin/env bash

echo "FLUSHALL" | redis-cli
rm state.json