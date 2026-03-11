# Testing

The test suite covers five layers: C# unit tests for the SimHub plugin logic, Python dataset validation, Python telemetry replay with synthetic scenarios, TypeScript Jest tests for the Homebridge plugin, and Python installer/export validation. No layer requires a running SimHub instance or live sim session.

## Test Suites at a Glance

| Suite | Language | Framework | Tests | What It Covers |
|-------|----------|-----------|-------|----------------|
| MediaCoach.Tests | C# | NUnit (.NET 6.0) | 200+ | Trigger evaluation, fragment assembly, color resolution, dataset validation |
| validate_datasets.py | Python | unittest | 28 | JSON structure, cross-references, threshold regressions |
| replay_telemetry.py | Python | — | 7 scenarios | End-to-end trigger pipeline against synthetic telemetry |
| Homebridge tests | TypeScript | Jest | 133 | Color mapping, SimHub client, per-light mode overrides |
| test_installer.py | Python | unittest | 34 | Installer structure, simulated install/export, file manifests |

## C# Unit Tests

```
tests/MediaCoach.Tests/
├── TriggerEvaluatorTests.cs        84 tests — all 18 trigger conditions
├── FragmentAssemblerTests.cs       35 tests — assembly, repetition, placeholders
├── ColorResolverTests.cs           50+ tests — category/severity colors, flag collisions
├── NormalizeColorTests.cs          25+ tests — hex format conversion
├── DatasetValidationTests.cs       20+ tests — live validation of JSON files
└── TestHelpers/
    ├── TriggerEvaluator.cs         Standalone reimplementation (no SimHub refs)
    ├── FragmentAssembler.cs         Standalone reimplementation
    ├── CommentaryColorResolver.cs   Standalone reimplementation
    ├── TelemetrySnapshot.cs         Pure data model
    └── Models.cs                    Topic/trigger/fragment models
```

### Why TestHelpers Exist

The SimHub plugin references `SimHub.Plugins.dll`, `GameReaderCommon.dll`, and `SimHub.Logging.dll` — assemblies that only exist inside a SimHub installation on Windows. The test project targets .NET 6.0 (cross-platform) and reimplements the pure logic from the plugin's engine classes in `TestHelpers/`. This means the tests run anywhere with the .NET SDK installed, including CI environments, without needing SimHub.

The TestHelpers mirror the plugin's logic exactly. They're kept in sync manually — when the plugin code changes, the corresponding TestHelper should be updated to match. The `DatasetValidationTests` class reads the actual JSON files from the repo, so those tests catch real dataset issues regardless of code drift.

### Running

```bash
cd tests/MediaCoach.Tests
dotnet test --verbosity normal
```

All 200+ tests complete in under 2 seconds.

### Key Test Categories

**TriggerEvaluatorTests** exercises every condition type with known inputs and verifies the expected boolean result. Includes regression tests for every threshold that was corrected during development:
- Tyre wear inversion (must use `<`, not `>`)
- Fahrenheit temperature thresholds (must be >= 200)
- Kerb hit sensitivity (thresholdDelta >= 10)
- Heavy braking threshold (value <= -38)
- Spin catch yaw rate (absValue >= 3.0)
- Proximity threshold (must be <= 0.008)

**FragmentAssemblerTests** verifies sentence composition, placeholder substitution (`{ahead}`, `{behind}`, `{value}`), repetition avoidance (ring buffer behavior), and graceful handling of missing fragment data.

**ColorResolverTests** validates the category-to-hue mapping, severity-to-alpha mapping, output format (`#AARRGGBB`), and flag collision detection. Ensures no category hue falls within 15 degrees of any flag hue.

**NormalizeColorTests** covers all input format conversions: `#RGB` → `#FFRRGGBB`, `#RRGGBB` → `#FFRRGGBB`, `#AARRGGBB` passthrough, edge cases (empty string, null, malformed).

## Python Dataset Validation

```bash
python3 tests/validate_datasets.py
```

28 tests across 4 test classes:

**TestTopicsDataset** — Structural validation of `commentary_topics.json`: required fields present, categories are valid enum values, trigger conditions are in the known set, severities are 1-5, cooldowns are positive. Includes all threshold regression tests (tyre wear direction, temperature units, delta thresholds).

**TestFragmentsDataset** — Every topic has matching fragments. Minimum combination count (100+ per topic). No empty openers or bodies. At most one empty closer per topic. No orphan fragments (fragments for topics that don't exist).

**TestSentimentsDataset** — All sentiments have `id` and `color`. Colors are valid hex. No sentiment color collides with flag hues (red H0, yellow H60, blue H240, orange H30) within a 15-degree tolerance.

**TestCrossReferences** — Every sentiment referenced by a topic exists in `sentiments.json`. No duplicate IDs across topics or fragments.

## Telemetry Replay

```bash
# Generate a synthetic scenario and run it through the trigger pipeline
python3 tools/replay_telemetry.py generate full_race

# Replay a recorded JSONL file
python3 tools/replay_telemetry.py replay tests/recordings/synthetic_full_race.jsonl

# Compare two transcripts for regression testing
python3 tools/replay_telemetry.py diff transcript_a.json transcript_b.json

# List available scenarios
python3 tools/replay_telemetry.py list
```

The replay tool reimplements the full trigger evaluation pipeline in Python (all 18 condition types, cooldowns, severity-based interruption). It reads the actual `commentary_topics.json` and `commentary_fragments.json` from the repo, so it tests the real data.

### Synthetic Scenarios

| Scenario | Frames | Duration | Tests |
|----------|--------|----------|-------|
| full_race | 1770 | ~29 min | Race start, formation lap, position changes, spin, yellow flag, personal best |
| incident_heavy | 90 | ~1.5 min | Severe crash sequence with high G-force spikes |
| tyre_degradation | 300 | ~5 min | Progressive wear from 100% to 30% life, temperature buildup to 260°F |
| flag_sequence | 150 | ~2.5 min | Green → yellow → red → green flag transitions |
| race_start | 60 | ~1 min | Formation lap to lights out |
| pit_stop | 120 | ~2 min | Pit entry, service, pit exit |
| close_battle | 180 | ~3 min | Proximity oscillating between 0.005 and 0.03 track distance |

### Transcript Output

Each replay produces a JSON transcript with timestamped events:

```json
{
  "timestamp": "00:07:50",
  "topic": "spin_catch",
  "title": "Big Save",
  "severity": 5,
  "category": "car_response",
  "text": "Massive snap right there. Feel the yaw rate hitting the limit...",
  "color": "#FF66BB6A"
}
```

The `diff` command compares two transcripts and reports added, removed, or changed events — useful for verifying that threshold adjustments produce the expected changes in trigger behavior.

### Recording Real Telemetry

Enable `RecordMode` in the plugin settings, then drive a session. The plugin writes a JSONL file to the SimHub directory with one telemetry frame per line. This file can be replayed through the Python tool:

```bash
python3 tools/replay_telemetry.py replay path/to/recording.jsonl
```

This is how the threshold corrections were validated: record a session that felt wrong, replay it, identify which topics fired inappropriately, adjust thresholds, replay again, confirm the fix.

## Homebridge Jest Tests

```bash
cd homebridge-plugin
npm install
npm test
```

133 tests across 3 files:

**colorMapper.test.ts (84 tests)** — Flag color mapping for all 8 flag states. Severity color mapping for levels 0-5. Proximity color mapping at boundary values. Blink configuration for each blinkable state. HSB-to-hex and hex-to-HSB conversion accuracy.

**simhubClient.test.ts (24 tests)** — HTTP response parsing for each SimHub property. Timeout handling. Connection error recovery. Default state on failure. Color format normalization.

**perLightMode.test.ts (25 tests)** — Per-light mode override falls back to global when not specified. Per-light blink override falls back to global. Mixed configurations (some lights override, some inherit). Edge cases: undefined vs. explicit false for blink toggle.

Tests use mock HTTP responses and don't require a running SimHub instance.

## Installer and Export Tests

```bash
python3 tools/test_installer.py
```

34 tests across 5 test classes:

**TestInstallerStructure (11 tests)** — Validates `install.bat` exists and contains the expected references: DLL name, dataset folder, DashTemplates folder, SimHubWPF.exe detection, SIMHUB_PATH environment variable, default install locations, process check via `tasklist`, error handling with exit codes.

**TestExportStructure (6 tests)** — Validates `export.bat` references DLL, PDB, DashTemplates, explicitly excludes `_Backups`, checks for SimHub detection, and has error handling.

**TestRepoSourceFiles (4 tests)** — Verifies every file in the install manifest actually exists in the repo: DLL, all 5 dataset JSON files (and that they parse as valid JSON), and all 7 dashboard template files.

**TestSimulatedInstall (7 tests)** — Creates a fake SimHub directory in a temp folder, runs the installer's file operations in Python, and verifies: DLL content matches, PDB is present, all dataset files land correctly, installed JSON files are still valid, all dashboard files are present, SimHub's own DLLs are not overwritten, and running the install twice is idempotent.

**TestSimulatedExport (6 tests)** — Creates a fake SimHub directory with modified built files, runs the export logic, and verifies: DLL and PDB content matches the built versions, dashboard `.djson` and all assets are exported, `_Backups` directory is excluded, and dataset files are not copied from SimHub back to the repo.

On Windows, an additional **TestLiveInstall** class (3 tests) can be enabled with `--live` to actually execute the `.bat` files against a fake SimHub directory via `subprocess`.

## CI Integration

A GitHub Actions workflow (`.github/workflows/ci.yml`) runs all test suites on every push and pull request. None of the suites require SimHub, iRacing, Homebridge, or any external service.

The workflow runs four parallel jobs:

| Job | Runner | What It Runs |
|-----|--------|--------------|
| Python Tests | `ubuntu-latest` | Dataset validation (28), telemetry replay (4 scenarios), installer tests (34) |
| C# Tests | `ubuntu-latest` | NUnit test project (200+), .NET 6.0 SDK |
| Homebridge Tests | `ubuntu-latest` | `npm ci`, TypeScript build, Jest (133) |
| Windows Installer | `windows-latest` | Live `.bat` execution against fake SimHub directory (3) |

The first three jobs share `ubuntu-latest` and run in parallel. The Windows job runs separately on `windows-latest` to test the actual batch file execution. All four jobs complete in under 2 minutes total.

To run locally without CI:

```bash
# Python (no dependencies beyond stdlib)
python3 tests/validate_datasets.py
python3 tools/replay_telemetry.py generate full_race
python3 tools/test_installer.py

# C# (.NET 6.0 SDK)
cd tests/MediaCoach.Tests && dotnet test

# Homebridge (Node.js 18+)
cd homebridge-plugin && npm ci && npm test
```
