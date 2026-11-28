#!/bin/bash
# Each plan (and the default playbook as a baseline) on the sample week and 32 built rosters.
cd /home/user/nbarpg
run() { # $1 label, $2 encounter, $3 strategy (may be empty)
  echo "=== $1 ($2)"
  ENC=$2 STRATEGY=$3 npx tsx prototypes/play-calling/scripts/sim.ts 2>&1 | grep -E "^(normal|hard) (expert|smart)" | sed -E 's/ breach.*//; s/ \(every saved play and Iso, best defense\)//; s/^/  sample /'
  ROSTERS=8 MODES=balance,offense,defense,flexibility ENC=$2 STRATEGY=$3 npx tsx prototypes/play-calling/scripts/sim.ts 2>&1 | grep -E "wins" | sed 's/^/  built  /'
}
run "baseline (default playbook)" goblin-horde ""
run "Clear the Ram" goblin-horde gh-ram
run "Hunt Champions" goblin-horde gh-hunt
run "Lockdown" goblin-horde gh-lockdown
run "baseline (default playbook)" crypt ""
run "Fire Volume" crypt cr-fire
run "Stop the Ritual" crypt cr-stop
run "Face the Lich" crypt cr-lich
echo DONE
