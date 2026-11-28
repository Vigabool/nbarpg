#!/bin/bash
# $1 label, $2 tuning JSON: Goblin Horde default book + Crypt suggested book (smart bot, built rosters)
cd /home/user/nbarpg
gh=$(BOOKS=critical-taunt,kick-out,frost-bolt,spread-the-floor TUNE="$2" npx tsx prototypes/play-calling/scripts/books.ts | sed -E 's/.*built normal ([-0-9.]+) \(([0-9]+)\/32\) hard ([-0-9.]+).*close ([0-9]+)%.*/\1 \/ \3 (close \4%)/')
cr=$(ENC=crypt BOOKS=critical-taunt,kick-out,shut-it-down,twin-smite TUNE="$2" npx tsx prototypes/play-calling/scripts/books.ts | sed -E 's/.*built normal ([-0-9.]+) \(([0-9]+)\/32\) hard ([-0-9.]+).*close ([0-9]+)%.*/\1 \/ \3 (close \4%)/')
echo "$1 | GH $gh | Crypt $cr"
