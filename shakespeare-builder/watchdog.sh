#!/bin/bash
# Shakespeare Skillbook Watchdog
# ================================
# Run every 5 minutes via cron. Ensures the builder is always running.
# Kills stale/stuck processes and restarts automatically.
#
# Cron entry (run: crontab -e):
#   */5 * * * * /Users/bodhi/.openclaw/workspace/spellbook/shakespeare/watchdog.sh >> /tmp/shakespeare-watchdog.log 2>&1

BUILDER_PY="/Users/bodhi/.openclaw/workspace/spellbook/shakespeare/builder.py"
PYTHON="/Users/bodhi/.openclaw/workspace/spellbook/shakespeare/.venv/bin/python3"
PROGRESS_FILE="/Users/bodhi/.openclaw/workspace/spellbook/shakespeare/PROGRESS.json"
LOCK_FILE="/tmp/shakespeare-builder.lock"
LOG_FILE="/tmp/shakespeare-builder.log"
WATCHDOG_LOG="/tmp/shakespeare-watchdog.log"
STALE_THRESHOLD=600   # seconds: if no heartbeat in 10 min, consider stale

# ── Helpers ────────────────────────────────────────────────────
ts() { date "+%Y-%m-%d %H:%M:%S"; }
log() { echo "[$(ts)] WATCHDOG: $*"; }

log "--- check start ---"

# ── 1. Already complete? ───────────────────────────────────────
STATUS=$("$PYTHON" -c "
import json, sys
try:
    with open('$PROGRESS_FILE') as f:
        d = json.load(f)
    print(d.get('status', 'unknown'))
except Exception as e:
    print('error:' + str(e))
" 2>/dev/null)

if [ "$STATUS" = "complete" ]; then
    log "Build already COMPLETE. Watchdog done."
    exit 0
fi

log "Build status: $STATUS"

# ── 2. Is builder process alive? ──────────────────────────────
RUNNING=0
PID=""

if [ -f "$LOCK_FILE" ]; then
    PID=$(cat "$LOCK_FILE" 2>/dev/null | tr -d '[:space:]')
    if [ -n "$PID" ] && kill -0 "$PID" 2>/dev/null; then
        log "Builder process running (PID $PID)"
        RUNNING=1
    else
        log "Lock file exists but PID $PID is dead. Cleaning up."
        rm -f "$LOCK_FILE"
    fi
fi

# ── 3. If running, check heartbeat freshness ──────────────────
if [ "$RUNNING" = "1" ]; then
    STALE=$("$PYTHON" -c "
import json, time, sys
try:
    with open('$PROGRESS_FILE') as f:
        d = json.load(f)
    last = d.get('last_seen', 0)
    age = time.time() - last
    print('stale' if age > $STALE_THRESHOLD else 'ok')
except Exception as e:
    print('error')
" 2>/dev/null)

    if [ "$STALE" = "ok" ]; then
        log "Builder is alive and heartbeating. All good. Exiting."
        exit 0
    else
        log "Builder PID $PID exists but heartbeat is STALE (>${STALE_THRESHOLD}s). Killing and restarting..."
        kill "$PID" 2>/dev/null
        sleep 3
        kill -9 "$PID" 2>/dev/null 2>&1 || true
        rm -f "$LOCK_FILE"
        sleep 2
    fi
fi

# ── 4. Start the builder ───────────────────────────────────────
log "Starting builder..."
nohup "$PYTHON" "$BUILDER_PY" >> "$LOG_FILE" 2>&1 &
NEW_PID=$!

# Give it a moment to write its own lock file
sleep 3

if kill -0 "$NEW_PID" 2>/dev/null; then
    log "Builder started successfully (PID $NEW_PID)"
else
    log "ERROR: Builder process died immediately! Check $LOG_FILE"
    exit 1
fi

log "--- check end ---"
exit 0
