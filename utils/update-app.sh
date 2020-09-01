#!/bin/bash

# This script is used for quickly refreshing the cache and updating the app
# ONLY FOR USE ON A DEPLOYED SERVER

RED='\033[0;31m'
ORANGE='\033[0;33m'
COLOUR_END='\033[0m'

if [ -d "/data/nginx/cache/" ] && [ -d "/home/beer/beer-fest.js/" ]
then

    echo -e "${ORANGE}WARNING: This will take the app down for a few seconds!${COLOUR_END}"
    read -p "Are you sure you want to wipe the cache, pull in recent changes and reload the app? (y/n) "

    if [[ $REPLY =~ ^[Yy]$ ]]
    then
        echo
        echo "==> Getting sudo password for use later"
        sudo true

        echo
        echo "==> Changing to beer-fest.js directory"
        cd /home/beer/beer-fest.js/

        echo
        echo "==> Fetching the latest changes from GitHub"
        git fetch origin master

        echo
        echo "==> Stopping app"
        pm2 stop beer-fest.js

        echo
        echo "==> Removing cache"
        sudo rm -r /data/nginx/cache/*

        echo
        echo "==> Merging in latest changes from GitHub"
        git merge --ff-only origin master

        echo
        echo "==> Starting app"
        pm2 start server.js --name beer-fest.js #--watch --ignore-watch ./public/downloads
    fi
else
    echo -e "${RED}ERROR: This script is only intened to be run on a deployed server with nginx${COLOUR_END}"
fi
