#!/usr/bin/env python3
"""
Telemetry Replay & Transcript Generator for Media Coach plugin.

Replays a recorded telemetry JSONL file through the topic trigger system
and produces a timestamped transcript of what prompts would have fired.

Also supports generating synthetic telemetry recordings for testing
specific scenarios without needing a live sim session.

Usage:
  # Replay a recording
  python3 tools/replay_telemetry.py replay <recording.jsonl>

  # Generate a synthetic recording and immediately replay it
  python3 tools/replay_telemetry.py generate [scenario_name]

  # Compare two recordings (regression testing)
  python3 tools/replay_telemetry.py diff <transcript_a.json> <transcript_b.json>

Scenarios available for 'generate': race_start, pit_stop, incident_heavy,
close_battle, tyre_degradation, full_race, flag_sequence
"""

import json
import math
import os
import sys
from dataclasses import dataclass, field, asdict
from pathlib import Path
from typing import Optional

DATASET_DIR = Path(__file__).resolve().parent.parent / "dataset"
TOPICS_PATH = DATASET_DIR / "commentary_topics.json"
FRAGMENTS_PATH = DATASET_DIR / "commentary_fragments.json"
RECORDINGS_DIR = Path(__file__).resolve().parent.parent / "tests" / "recordings"

# ─── Telemetry Snapshot (mirrors C# TelemetrySnapshot) ─────────────────────

FLAG_CHECKERED = 0x0001
FLAG_WHITE = 0x0002
FLAG_GREEN = 0x0004
FLAG_YELLOW = 0x0008 | 0x4000 | 0x8000
FLAG_RED = 0x0010
FLAG_BLUE = 0x0020
FLAG_DEBRIS = 0x0040
FLAG_BLACK = 0x00010000


@dataclass
class Snapshot:
    GameRunning: bool = True
    GameName: str = "iRacing"
    SpeedKmh: float = 0.0
    Rpms: float = 0.0
    Gear: str = "4"
    Throttle: float = 0.0
    Brake: float = 0.0
    FuelLevel: float = 20.0
    FuelPercent: float = 0.45
    CurrentLap: int = 5
    CompletedLaps: int = 4
    TrackPositionPct: float = 0.5
    Position: int = 6
    IsInPit: bool = False
    IsInPitLane: bool = False
    SessionTypeName: str = "Race"
    TyreWearFL: float = 0.60
    TyreWearFR: float = 0.58
    TyreWearRL: float = 0.65
    TyreWearRR: float = 0.63
    LatAccel: float = 0.0
    LongAccel: float = 0.0
    VertAccel: float = 1.0
    YawRate: float = 0.0
    AbsActive: bool = False
    TcActive: bool = False
    TyreTempFL: float = 195.0
    TyreTempFR: float = 198.0
    TyreTempRL: float = 190.0
    TyreTempRR: float = 192.0
    TrackTemp: float = 36.0
    WeatherWet: bool = False
    LapDeltaToBest: float = 0.1
    LapCurrentTime: float = 45.0
    LapLastTime: float = 92.5
    LapBestTime: float = 92.0
    SessionTimeRemain: float = 1800.0
    SteeringWheelTorque: float = 3.0
    SessionFlags: int = 0
    IncidentCount: int = 0
    DrsStatus: int = 0
    ErsBattery: float = 0.7
    MgukPower: float = 0.0
    CarIdxLapDistPct: list = field(default_factory=list)
    CarIdxOnPitRoad: list = field(default_factory=list)
    PlayerCarIdx: int = 0
    NearestAheadName: str = "A. Martinez"
    NearestAheadRating: int = 2847
    NearestBehindName: str = "J. Williams"
    NearestBehindRating: int = 3214


# ─── Trigger Evaluator (mirrors C# TriggerEvaluator) ──────────────────────

def get_value(snap: Snapshot, data_point: str) -> float:
    dp = (data_point or "").lower()
    mapping = {
        "speedkmh": "SpeedKmh", "rpms": "Rpms", "throttle": "Throttle",
        "brake": "Brake", "fuellevel": "FuelLevel", "fuellevelpct": "FuelPercent",
        "fuelpercent": "FuelPercent", "currentlap": "CurrentLap", "lap": "CurrentLap",
        "completedlaps": "CompletedLaps", "trackpositionpercent": "TrackPositionPct",
        "lapdistpct": "TrackPositionPct", "position": "Position",
        "lateralataccel": "LatAccel", "lataccel": "LatAccel",
        "longitudinalaccel": "LongAccel", "longaccel": "LongAccel",
        "vertaccel": "VertAccel", "yawrate": "YawRate",
        "steeringwheeltorque": "SteeringWheelTorque",
        "lapdeltatobest": "LapDeltaToBest", "lapdeltatobestlap": "LapDeltaToBest",
        "lapcurrentlaptime": "LapCurrentTime", "laplastlaptime": "LapLastTime",
        "lapbestlaptime": "LapBestTime", "sessiontimeremain": "SessionTimeRemain",
        "sessionflags": "SessionFlags",
        "playercarincidentcount": "IncidentCount", "playercarincident": "IncidentCount",
        "playercarmyincidentcount": "IncidentCount",
        "drsstatus": "DrsStatus", "tracktemp": "TrackTemp",
        "energyersbattery": "ErsBattery", "powermguk": "MgukPower",
        "tyrewearfl": "TyreWearFL", "tyrewearfr": "TyreWearFR",
        "tyrewearrl": "TyreWearRL", "tyrewearrr": "TyreWearRR",
        "tyretempfl": "TyreTempFL", "tyretempfr": "TyreTempFR",
        "tyretemprl": "TyreTempRL", "tyretemprr": "TyreTempRR",
    }
    attr = mapping.get(dp)
    if attr:
        return float(getattr(snap, attr, 0))
    return 0.0


def get_bool(snap: Snapshot, data_point: str) -> bool:
    dp = (data_point or "").lower()
    mapping = {
        "brakeabsactive": "AbsActive", "absactive": "AbsActive",
        "tcactive": "TcActive", "weatherdeclaredwet": "WeatherWet",
        "wet": "WeatherWet", "isinpit": "IsInPit", "isinpitlane": "IsInPitLane",
    }
    attr = mapping.get(dp)
    return bool(getattr(snap, attr, False)) if attr else False


def evaluate_trigger(trigger: dict, cur: Snapshot, prev: Optional[Snapshot]) -> bool:
    if not cur.GameRunning:
        return False

    cond = (trigger.get("condition") or "").lower()
    dp = trigger.get("dataPoint", "")
    val = trigger.get("value")
    threshold_delta = trigger.get("thresholdDelta")
    abs_val = trigger.get("absValue")

    if cond == ">":
        return val is not None and get_value(cur, dp) > val
    elif cond == "<":
        return val is not None and get_value(cur, dp) < val
    elif cond == "==":
        if val is not None:
            if dp.lower() in ("brakeabsactive", "absactive", "tcactive",
                               "weatherdeclaredwet", "wet", "isinpit", "isinpitlane"):
                b = get_bool(cur, dp)
                return b if val >= 1 else not b
            return abs(get_value(cur, dp) - val) < 0.001
        return False
    elif cond == "change":
        if prev is None:
            return False
        delta = abs(get_value(cur, dp) - get_value(prev, dp))
        return delta >= (threshold_delta or 0.5)
    elif cond == "increase":
        if prev is None:
            return False
        return get_value(cur, dp) > get_value(prev, dp)
    elif cond == "spike":
        if prev is None or threshold_delta is None:
            return False
        delta = get_value(cur, dp) - get_value(prev, dp)
        return delta >= threshold_delta
    elif cond == "sudden_drop":
        if prev is None or threshold_delta is None:
            return False
        delta = get_value(cur, dp) - get_value(prev, dp)
        return delta <= threshold_delta
    elif cond == "extreme":
        if abs_val is None:
            return False
        return abs(get_value(cur, dp)) >= abs_val
    elif cond == "rapid_change":
        if prev is None:
            return False
        if dp.lower() == "gear":
            return abs(_parse_gear(cur.Gear) - _parse_gear(prev.Gear)) >= 2
        delta = abs(get_value(cur, dp) - get_value(prev, dp))
        return delta >= (threshold_delta or 0.5)
    elif cond == "personal_best":
        if prev is None:
            return False
        return (cur.LapLastTime > 0
                and cur.LapLastTime < cur.LapBestTime
                and cur.LapLastTime != prev.LapLastTime)
    elif cond == "player_gain_position":
        if prev is None or prev.Position <= 0 or cur.Position <= 0:
            return False
        return cur.Position < prev.Position
    elif cond == "player_lost_position":
        if prev is None or prev.Position <= 0 or cur.Position <= 0:
            return False
        return cur.Position > prev.Position
    elif cond == "player_entering":
        if prev is None:
            return False
        return cur.IsInPitLane and not prev.IsInPitLane
    elif cond == "off_track":
        if prev is None:
            return False
        return abs(cur.VertAccel) > 8.0 and abs(prev.VertAccel) < 4.0
    elif cond == "yellow_flag":
        if prev is None:
            return False
        return (cur.SessionFlags & FLAG_YELLOW) != 0 and (prev.SessionFlags & FLAG_YELLOW) == 0
    elif cond == "black_flag":
        if prev is None:
            return False
        return (cur.SessionFlags & FLAG_BLACK) != 0 and (prev.SessionFlags & FLAG_BLACK) == 0
    elif cond == "race_start":
        if prev is None:
            return False
        return (cur.SessionTypeName == "Race"
                and cur.CurrentLap == 1
                and cur.CompletedLaps == 0
                and prev.CurrentLap == 0)
    elif cond == "close_proximity":
        threshold = trigger.get("proximityThreshold", 0.02)
        player_pos = cur.TrackPositionPct
        player_idx = cur.PlayerCarIdx
        for i, other in enumerate(cur.CarIdxLapDistPct):
            if i == player_idx:
                continue
            if other <= 0:
                continue
            delta = abs(player_pos - other)
            delta = min(delta, 1.0 - delta)
            if delta < threshold:
                return True
        return False
    return False


def _parse_gear(gear: str) -> int:
    if not gear:
        return 0
    if gear == "R":
        return -1
    if gear == "N":
        return 0
    try:
        return int(gear)
    except ValueError:
        return 0


# ─── Replay Engine ──────────────────────────────────────────────────────────

CATEGORY_COLORS = {
    "hardware": "00ACC1",
    "game_feel": "AB47BC",
    "car_response": "66BB6A",
    "racing_experience": "EC407A",
}

SEVERITY_ALPHAS = {1: "66", 2: "8C", 3: "B3", 4: "D9", 5: "FF"}
SEVERITY_LABELS = {1: "Info", 2: "Notable", 3: "Significant", 4: "Urgent", 5: "Critical"}


def load_topics():
    with open(TOPICS_PATH) as f:
        data = json.load(f)
    return data.get("topics", [])


def load_fragments():
    with open(FRAGMENTS_PATH) as f:
        data = json.load(f)
    return {f["topicId"]: f["fragments"] for f in data.get("fragments", [])}


def replay(frames: list[dict], topics: list[dict], fragments: dict) -> list[dict]:
    """
    Replay telemetry frames through the trigger system.
    Returns a transcript list of events.
    """
    import random

    topic_last_fire = {}  # topicId → elapsed seconds
    last_fire_at = -999.0
    anti_spam = 8.0
    current_severity = 0
    current_expire = 0.0
    display_seconds = 15.0
    transcript = []

    prev_snap = None

    for frame in frames:
        elapsed = frame.get("T", 0)
        snap_data = frame.get("S", {})
        cur_snap = Snapshot(**{
            k: v for k, v in snap_data.items()
            if hasattr(Snapshot, k)
        })

        if not cur_snap.GameRunning:
            prev_snap = cur_snap
            continue

        # Check if current prompt expired
        if elapsed >= current_expire:
            current_severity = 0

        # Sort topics by severity descending
        sorted_topics = sorted(topics, key=lambda t: t.get("severity", 0), reverse=True)

        for topic in sorted_topics:
            topic_id = topic["id"]
            sev = topic.get("severity", 2)

            # Session type filter
            session_types = topic.get("sessionTypes", [])
            if session_types:
                sn = (cur_snap.SessionTypeName or "").lower()
                if not any(st.lower() in sn for st in session_types):
                    continue

            # Cooldown check
            cooldown_secs = topic.get("cooldownMinutes", 2) * 60
            if topic_id in topic_last_fire:
                if elapsed - topic_last_fire[topic_id] < cooldown_secs:
                    continue

            # Trigger evaluation
            fires = False
            for trigger in topic.get("triggers", []):
                if evaluate_trigger(trigger, cur_snap, prev_snap):
                    fires = True
                    break
            if not fires:
                continue

            # Severity-based interruption
            if current_severity > 0 and elapsed < current_expire:
                if sev <= current_severity:
                    continue

            # Anti-spam
            if current_severity == 0 and (elapsed - last_fire_at < anti_spam) and sev < 4:
                continue

            # Fire!
            prompts = topic.get("commentaryPrompts", [])
            prompt = prompts[len(transcript) % len(prompts)] if prompts else ""

            # Pick a fragment if available
            if topic_id in fragments:
                frags = fragments[topic_id]
                opener = random.choice(frags.get("openers", [""])) if frags.get("openers") else ""
                body = random.choice(frags.get("bodies", [""])) if frags.get("bodies") else ""
                closer = random.choice(frags.get("closers", [""])) if frags.get("closers") else ""
                assembled = f"{opener} {body} {closer}".strip()
                if assembled:
                    prompt = assembled

            cat = topic.get("category", "")
            rgb = CATEGORY_COLORS.get(cat, "37474F")
            alpha = SEVERITY_ALPHAS.get(sev, "B3")

            entry = {
                "time": elapsed,
                "time_formatted": format_time(elapsed),
                "topicId": topic_id,
                "title": topic.get("title", ""),
                "category": cat,
                "severity": sev,
                "severityLabel": SEVERITY_LABELS.get(sev, ""),
                "color": f"#{alpha}{rgb}",
                "prompt": prompt,
                "interrupted": current_severity > 0 and elapsed < current_expire,
                "interruptedTopic": transcript[-1]["topicId"] if transcript and current_severity > 0 and elapsed < current_expire else None,
            }
            transcript.append(entry)

            topic_last_fire[topic_id] = elapsed
            last_fire_at = elapsed
            current_severity = sev
            current_expire = elapsed + display_seconds
            break

        prev_snap = cur_snap

    return transcript


def format_time(seconds: float) -> str:
    m, s = divmod(int(seconds), 60)
    h, m = divmod(m, 60)
    return f"{h:02d}:{m:02d}:{s:02d}"


# ─── Scenario Generators ────────────────────────────────────────────────────

def _base() -> dict:
    return asdict(Snapshot())


def generate_scenario(name: str) -> list[dict]:
    """Generate a synthetic telemetry recording for a named scenario."""
    generators = {
        "race_start": _gen_race_start,
        "pit_stop": _gen_pit_stop,
        "incident_heavy": _gen_incident_heavy,
        "close_battle": _gen_close_battle,
        "tyre_degradation": _gen_tyre_degradation,
        "full_race": _gen_full_race,
        "flag_sequence": _gen_flag_sequence,
    }
    gen = generators.get(name)
    if gen is None:
        print(f"Unknown scenario: {name}")
        print(f"Available: {', '.join(sorted(generators.keys()))}")
        sys.exit(1)
    return gen()


def _gen_race_start() -> list[dict]:
    """Simulates formation lap → green flag → first few laps with close racing."""
    frames = []
    base = _base()

    # Formation lap (10 seconds)
    for t in range(0, 10):
        s = {**base, "CurrentLap": 0, "CompletedLaps": 0, "SpeedKmh": 80.0,
             "Position": 6, "SessionFlags": FLAG_GREEN}
        frames.append({"T": float(t), "S": s})

    # Green flag drop
    for t in range(10, 30):
        elapsed = float(t)
        s = {**base, "CurrentLap": 1, "CompletedLaps": 0,
             "SpeedKmh": 80 + (t - 10) * 6, "Throttle": 1.0,
             "LatAccel": 0.5 + (t - 10) * 0.1,
             "Position": 6, "SessionFlags": FLAG_GREEN}
        frames.append({"T": elapsed, "S": s})

    # First lap racing, close battle
    for t in range(30, 90):
        s = {**base, "CurrentLap": 1, "CompletedLaps": 0,
             "SpeedKmh": 180 + math.sin(t * 0.1) * 30,
             "LatAccel": 2.0 + math.sin(t * 0.2) * 1.5,
             "Position": 6,
             "CarIdxLapDistPct": [0.0, 0.5, 0.503, 0.497],
             "PlayerCarIdx": 1}
        frames.append({"T": float(t), "S": s})

    # Position gained
    for t in range(90, 120):
        s = {**base, "CurrentLap": 2, "CompletedLaps": 1,
             "SpeedKmh": 190, "Position": 5 if t >= 95 else 6}
        frames.append({"T": float(t), "S": s})

    return frames


def _gen_pit_stop() -> list[dict]:
    """Simulates approaching pit, entering, and leaving."""
    frames = []
    base = _base()

    # Approaching pit
    for t in range(0, 30):
        s = {**base, "CurrentLap": 15, "FuelPercent": 0.08, "FuelLevel": 3.5,
             "SpeedKmh": 200 - t * 5, "Position": 8}
        frames.append({"T": float(t), "S": s})

    # Entering pit lane
    for t in range(30, 60):
        s = {**base, "CurrentLap": 15, "FuelPercent": 0.06, "SpeedKmh": 60,
             "IsInPitLane": True, "IsInPit": t >= 40, "Position": 8}
        frames.append({"T": float(t), "S": s})

    # Leaving pit
    for t in range(60, 90):
        s = {**base, "CurrentLap": 16, "FuelPercent": 0.95, "SpeedKmh": 60 + t - 60,
             "IsInPitLane": t < 70, "Position": 12}
        frames.append({"T": float(t), "S": s})

    return frames


def _gen_incident_heavy() -> list[dict]:
    """Simulates a crash sequence: spin → wall → off track → recovery."""
    frames = []
    base = _base()

    # Normal driving
    for t in range(0, 20):
        s = {**base, "SpeedKmh": 200, "LatAccel": 2.0, "VertAccel": 1.0}
        frames.append({"T": float(t), "S": s})

    # Snap oversteer (spin catch trigger)
    for t in range(20, 25):
        s = {**base, "SpeedKmh": 180, "YawRate": 3.5, "LatAccel": 4.0, "VertAccel": 2.0}
        frames.append({"T": float(t), "S": s})

    # Wall contact
    for t in range(25, 30):
        s = {**base, "SpeedKmh": 20, "VertAccel": 15.0, "IncidentCount": 4, "YawRate": 0.5}
        frames.append({"T": float(t), "S": s})

    # Off track / stopped
    for t in range(30, 60):
        s = {**base, "SpeedKmh": 0, "VertAccel": 1.0, "IncidentCount": 4}
        frames.append({"T": float(t), "S": s})

    # Slow recovery
    for t in range(60, 90):
        s = {**base, "SpeedKmh": t - 30, "VertAccel": 1.0, "IncidentCount": 4}
        frames.append({"T": float(t), "S": s})

    return frames


def _gen_close_battle() -> list[dict]:
    """Simulates 2 minutes of door-to-door racing with position changes."""
    frames = []
    base = _base()

    for t in range(0, 120):
        gap = 0.005 + math.sin(t * 0.05) * 0.004  # oscillates between 0.001 and 0.009
        pos = 6 if t < 60 else (5 if t < 80 else 6)  # gain then lose position
        s = {**base, "SpeedKmh": 190 + math.sin(t * 0.1) * 20,
             "LatAccel": 2.5 + math.sin(t * 0.15) * 2.0,
             "Position": pos,
             "CarIdxLapDistPct": [0.0, 0.5, 0.5 + gap],
             "PlayerCarIdx": 1,
             "CurrentLap": 8 + t // 60}
        frames.append({"T": float(t), "S": s})

    return frames


def _gen_tyre_degradation() -> list[dict]:
    """Simulates a long stint with gradual tyre degradation and overheating."""
    frames = []
    base = _base()

    for t in range(0, 300):  # 5 minutes
        wear = 0.70 - t * 0.002  # goes from 0.70 down to 0.10
        temp = 195 + t * 0.2     # goes from 195°F up to 255°F
        s = {**base, "TyreWearFL": wear, "TyreWearFR": wear - 0.02,
             "TyreWearRL": wear + 0.05, "TyreWearRR": wear + 0.03,
             "TyreTempFL": temp, "TyreTempFR": temp + 3,
             "TyreTempRL": temp - 5, "TyreTempRR": temp - 3,
             "CurrentLap": 5 + t // 60, "SpeedKmh": 190}
        frames.append({"T": float(t), "S": s})

    return frames


def _gen_flag_sequence() -> list[dict]:
    """Simulates a sequence of flag states: green → yellow → green → debris → red."""
    frames = []
    base = _base()

    flag_timeline = [
        (0, 30, 0),            # no flags
        (30, 60, FLAG_YELLOW),  # yellow flag
        (60, 90, 0),            # green
        (90, 110, FLAG_DEBRIS), # debris
        (110, 130, 0),          # green
        (130, 150, FLAG_RED),   # red
    ]

    for start, end, flags in flag_timeline:
        for t in range(start, end):
            s = {**base, "SessionFlags": flags, "SpeedKmh": 190 if flags != FLAG_RED else 60}
            frames.append({"T": float(t), "S": s})

    return frames


def _gen_full_race() -> list[dict]:
    """Simulates a complete 20-lap race arc with varied events."""
    frames = []
    base = _base()
    t = 0.0

    # Formation lap
    for _ in range(15):
        s = {**base, "CurrentLap": 0, "CompletedLaps": 0, "SpeedKmh": 80,
             "Position": 6, "SessionFlags": FLAG_GREEN}
        frames.append({"T": t, "S": s})
        t += 1.0

    # Race start (lap 0→1)
    for _ in range(5):
        s = {**base, "CurrentLap": 1, "CompletedLaps": 0, "SpeedKmh": 160, "Position": 6,
             "Throttle": 1.0, "SessionFlags": FLAG_GREEN}
        frames.append({"T": t, "S": s})
        t += 1.0

    # Laps 1-5: settling in, close racing
    for lap in range(1, 6):
        for sec in range(0, 90):
            wear = 0.90 - lap * 0.03
            temp = 195 + lap * 2
            gap = 0.006 if lap < 3 else 0.02
            s = {**base, "CurrentLap": lap, "CompletedLaps": lap - 1,
                 "SpeedKmh": 180 + math.sin(sec * 0.1) * 25,
                 "LatAccel": 2.0 + math.sin(sec * 0.15) * 1.5,
                 "TyreWearFL": wear, "TyreTempFL": temp, "TyreTempFR": temp + 2,
                 "Position": 6, "FuelPercent": 0.90 - lap * 0.04,
                 "CarIdxLapDistPct": [0.0, sec / 90.0, sec / 90.0 + gap],
                 "PlayerCarIdx": 1}
            frames.append({"T": t, "S": s})
            t += 1.0

    # Lap 6: spin event
    for sec in range(0, 10):
        s = {**base, "CurrentLap": 6, "SpeedKmh": 140, "YawRate": 3.2 if sec < 3 else 0.5,
             "VertAccel": 2.0, "Position": 6}
        frames.append({"T": t, "S": s})
        t += 1.0
    for sec in range(10, 90):
        s = {**base, "CurrentLap": 6, "SpeedKmh": 170, "Position": 8}  # dropped positions
        frames.append({"T": t, "S": s})
        t += 1.0

    # Laps 7-10: recovery, tyres degrading
    for lap in range(7, 11):
        for sec in range(0, 90):
            wear = 0.70 - (lap - 7) * 0.08
            temp = 210 + (lap - 7) * 10
            s = {**base, "CurrentLap": lap, "SpeedKmh": 185,
                 "TyreWearFL": wear, "TyreTempFL": temp, "TyreTempFR": temp + 3,
                 "Position": 8, "FuelPercent": 0.50 - (lap - 7) * 0.06}
            frames.append({"T": t, "S": s})
            t += 1.0

    # Lap 11: pit stop
    for sec in range(0, 30):
        s = {**base, "CurrentLap": 11, "SpeedKmh": 60,
             "IsInPitLane": True, "IsInPit": sec >= 10,
             "FuelPercent": 0.15, "Position": 10}
        frames.append({"T": t, "S": s})
        t += 1.0

    # Laps 12-18: out-lap and racing
    for lap in range(12, 19):
        for sec in range(0, 90):
            s = {**base, "CurrentLap": lap, "SpeedKmh": 190, "Position": 9,
                 "TyreWearFL": 0.95 - (lap - 12) * 0.02,
                 "TyreTempFL": 195 + (lap - 12) * 3,
                 "FuelPercent": 0.85 - (lap - 12) * 0.05}
            frames.append({"T": t, "S": s})
            t += 1.0

    # Lap 19: yellow flag
    for sec in range(0, 45):
        s = {**base, "CurrentLap": 19, "SpeedKmh": 100,
             "SessionFlags": FLAG_YELLOW, "Position": 9}
        frames.append({"T": t, "S": s})
        t += 1.0
    for sec in range(45, 90):
        s = {**base, "CurrentLap": 19, "SpeedKmh": 180, "Position": 9}
        frames.append({"T": t, "S": s})
        t += 1.0

    # Lap 20: final lap, personal best, position gained
    for sec in range(0, 50):
        s = {**base, "CurrentLap": 20, "SpeedKmh": 195,
             "LapDeltaToBest": -0.7, "Position": 9 if sec < 30 else 8}
        frames.append({"T": t, "S": s})
        t += 1.0

    # Personal best moment
    for sec in range(50, 90):
        s = {**base, "CurrentLap": 20, "SpeedKmh": 195, "Position": 8,
             "LapLastTime": 91.5, "LapBestTime": 92.0}
        frames.append({"T": t, "S": s})
        t += 1.0

    # Checkered flag
    for sec in range(0, 10):
        s = {**base, "CurrentLap": 20, "SpeedKmh": 150,
             "SessionFlags": FLAG_CHECKERED, "Position": 8}
        frames.append({"T": t, "S": s})
        t += 1.0

    return frames


# ─── Transcript Formatter ───────────────────────────────────────────────────

def print_transcript(transcript: list[dict], verbose: bool = True):
    if not transcript:
        print("No prompts fired during this recording.")
        print("Check that trigger thresholds match the telemetry values.")
        return

    print(f"\n── Transcript ({len(transcript)} prompts) {'─' * 50}\n")

    for entry in transcript:
        sev_label = entry.get("severityLabel", "")
        interrupted = " [INTERRUPT]" if entry.get("interrupted") else ""
        print(f"[{entry['time_formatted']}] {entry['title']} ({entry['topicId']}) "
              f"— {sev_label} (sev {entry['severity']}){interrupted}")
        if verbose:
            prompt = entry.get("prompt", "")
            if len(prompt) > 120:
                prompt = prompt[:117] + "..."
            print(f"  \"{prompt}\"")
            print(f"  Color: {entry['color']}  Category: {entry['category']}")
        print()

    # Summary
    print(f"── Summary {'─' * 60}\n")
    counts = {}
    for e in transcript:
        tid = e["topicId"]
        counts[tid] = counts.get(tid, 0) + 1

    for tid, count in sorted(counts.items(), key=lambda x: -x[1]):
        print(f"  {tid}: {count}×")

    total_time = transcript[-1]["time"] if transcript else 0
    print(f"\n  Total: {len(transcript)} prompts over {format_time(total_time)}")

    # Category distribution
    cat_counts = {}
    for e in transcript:
        cat = e.get("category", "unknown")
        cat_counts[cat] = cat_counts.get(cat, 0) + 1
    print(f"\n  Categories: {', '.join(f'{c}={n}' for c, n in sorted(cat_counts.items()))}")

    # Severity distribution
    sev_counts = {}
    for e in transcript:
        s = e.get("severity", 0)
        sev_counts[s] = sev_counts.get(s, 0) + 1
    print(f"  Severities: {', '.join(f'{s}={n}' for s, n in sorted(sev_counts.items()))}")

    # Interruptions
    interrupts = [e for e in transcript if e.get("interrupted")]
    if interrupts:
        print(f"  Interruptions: {len(interrupts)}")


def diff_transcripts(a_path: str, b_path: str):
    """Compare two transcript JSON files and show differences."""
    with open(a_path) as f:
        a = json.load(f)
    with open(b_path) as f:
        b = json.load(f)

    a_ids = [e["topicId"] for e in a]
    b_ids = [e["topicId"] for e in b]

    print(f"Transcript A: {len(a)} events")
    print(f"Transcript B: {len(b)} events")
    print()

    if a_ids == b_ids:
        print("Identical event sequences.")
        return

    # Find first difference
    for i, (ai, bi) in enumerate(zip(a_ids, b_ids)):
        if ai != bi:
            print(f"First difference at event #{i + 1}:")
            print(f"  A: [{a[i]['time_formatted']}] {a[i]['title']} ({ai})")
            print(f"  B: [{b[i]['time_formatted']}] {b[i]['title']} ({bi})")
            break

    # Topic frequency comparison
    a_counts = {}
    b_counts = {}
    for e in a:
        a_counts[e["topicId"]] = a_counts.get(e["topicId"], 0) + 1
    for e in b:
        b_counts[e["topicId"]] = b_counts.get(e["topicId"], 0) + 1

    all_topics = sorted(set(a_counts.keys()) | set(b_counts.keys()))
    print("\nTopic frequency comparison:")
    for tid in all_topics:
        ac = a_counts.get(tid, 0)
        bc = b_counts.get(tid, 0)
        diff = bc - ac
        marker = " ✓" if diff == 0 else f" ({'+' if diff > 0 else ''}{diff})"
        print(f"  {tid}: {ac} → {bc}{marker}")


# ─── CLI ────────────────────────────────────────────────────────────────────

def main():
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)

    cmd = sys.argv[1]

    if cmd == "replay":
        if len(sys.argv) < 3:
            print("Usage: replay_telemetry.py replay <recording.jsonl>")
            sys.exit(1)
        recording_path = sys.argv[2]
        with open(recording_path) as f:
            frames = [json.loads(line) for line in f if line.strip()]

        topics = load_topics()
        fragments = load_fragments()
        print(f"Loaded {len(topics)} topics, {len(fragments)} fragment sets")
        print(f"Replaying {len(frames)} frames from {recording_path}")

        transcript = replay(frames, topics, fragments)
        print_transcript(transcript)

        # Save transcript JSON
        out_path = recording_path.replace(".jsonl", "_transcript.json")
        with open(out_path, "w") as f:
            json.dump(transcript, f, indent=2)
        print(f"\nTranscript saved to {out_path}")

    elif cmd == "generate":
        scenario = sys.argv[2] if len(sys.argv) > 2 else "full_race"
        frames = generate_scenario(scenario)

        # Save recording
        os.makedirs(RECORDINGS_DIR, exist_ok=True)
        rec_path = RECORDINGS_DIR / f"synthetic_{scenario}.jsonl"
        with open(rec_path, "w") as f:
            for frame in frames:
                f.write(json.dumps(frame) + "\n")
        print(f"Generated {len(frames)} frames → {rec_path}")

        # Replay it
        topics = load_topics()
        fragments = load_fragments()
        print(f"Loaded {len(topics)} topics, {len(fragments)} fragment sets")

        transcript = replay(frames, topics, fragments)
        print_transcript(transcript)

        # Save transcript
        trans_path = RECORDINGS_DIR / f"synthetic_{scenario}_transcript.json"
        with open(trans_path, "w") as f:
            json.dump(transcript, f, indent=2)
        print(f"\nTranscript saved to {trans_path}")

    elif cmd == "diff":
        if len(sys.argv) < 4:
            print("Usage: replay_telemetry.py diff <transcript_a.json> <transcript_b.json>")
            sys.exit(1)
        diff_transcripts(sys.argv[2], sys.argv[3])

    elif cmd == "list":
        print("Available scenarios:")
        for name in sorted(["race_start", "pit_stop", "incident_heavy",
                            "close_battle", "tyre_degradation", "full_race",
                            "flag_sequence"]):
            print(f"  {name}")

    else:
        print(f"Unknown command: {cmd}")
        print(__doc__)
        sys.exit(1)


if __name__ == "__main__":
    main()
