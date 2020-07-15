#!/usr/bin/env bash

GREEN='\033[0;32m'
RED='\033[0;31m'
ORANGE='\033[0;33m'
COLOUR_END='\033[0m'

echo -e "${ORANGE}Be sure to run this script from the beer-fest.js root directory like this:${COLOUR_END}"
echo -e "${GREEN}source ./utils/clean.sh${COLOUR_END}\n"

echo -e "${RED}WARNING: This script is ruthless, use it at your own risk!${COLOUR_END}"
read -p "Are you sure you want to wipe out the redis database, env var secrets, beer information, and the docs? (y/n) "

if [[ $REPLY =~ ^[Yy]$ ]]
then
    # Clear the redis database
    echo "FLUSHALL" | redis-cli

    # This script needs to be sourced to unset the env vars in the current shell:
    #   source ./utils/clean.sh
    unset ADMIN_CODE
    unset COOKIE_SECRET

    # Wipe out the current beer information
    rm ./public/downloads/current-beers.csv

    # Wipe out the docs
    rm -r ./docs/jsdoc
fi