# Complete Telemetry Mapping: iRacing ↔ LMU/rF2 ↔ SimHub Normalized

## Table of Contents
1. Core Vehicle Dynamics
2. Driver Inputs
3. Tire Data
4. Driver Aids
5. Session & Scoring
6. Flags
7. Pit Lane
8. Energy Recovery / Hybrid
9. In-Car Adjustments
10. Multi-Car / Opponent Data
11. Career / Rating
12. Environment

---

## 1. Core Vehicle Dynamics

| Field | iRacing Raw | LMU/rF2 Raw | SimHub Normalized | Units | Conversion Notes |
|-------|------------|-------------|-------------------|-------|-----------------|
| Speed | `Speed` | `Telemetry.mSpeed` | `SpeedKmh` | m/s (raw), km/h (SimHub) | SimHub pre-converts to km/h |
| Lateral Accel | `LatAccel` | `Telemetry.mLocalAccel.x` | `AccelerationSway` | m/s² → G | Divide by 9.80665 |
| Long Accel | `LongAccel` | `Telemetry.mLocalAccel.z` | `AccelerationSurge` | m/s² → G | Divide by 9.80665 |
| Vert Accel | `VertAccel` | `Telemetry.mLocalAccel.y` | `AccelerationHeave` | m/s² → G | Divide by 9.80665 |
| Yaw Rate | `YawRate` | `Telemetry.mLocalRot.y` | `Yaw` | rad/s | Direct read |
| Velocity X | `VelocityX` | `Telemetry.mLocalVel.x` | `VelocityX` | m/s | Car-local lateral |
| Velocity Z | `VelocityZ` | `Telemetry.mLocalVel.z` | `VelocityZ` | m/s | Car-local forward |
| Heading/Yaw | `Yaw` | computed from `mOri` | `Yaw` | radians | rF2 may need extraction from orientation matrix |
| RPM | `RPM` | `Telemetry.mEngineRPM` | `Rpms` | RPM | Direct |
| Gear | `Gear` | `Telemetry.mGear` | `Gear` | int | -1=R, 0=N, 1+=forward |

## 2. Driver Inputs

| Field | iRacing Raw | LMU/rF2 Raw | SimHub Normalized | Units | Conversion Notes |
|-------|------------|-------------|-------------------|-------|-----------------|
| Throttle | `Throttle` | `Telemetry.mUnfilteredThrottle` | `ThrottlePedal` | 0-1 | Direct |
| Brake | `Brake` | `Telemetry.mUnfilteredBrake` | `BrakePedal` | 0-1 | Direct |
| Clutch | `Clutch` | `Telemetry.mUnfilteredClutch` | `ClutchPedal` | 0-1 | rF2: 1=disengaged; may need `1-value` |
| Steering Angle | `SteeringWheelAngle` | `Telemetry.mUnfilteredSteering` | N/A | radians (iR) / -1 to +1 (rF2) | ⚠️ MUST convert: multiply rF2 by π or by max steer angle |
| Steering Torque | `SteeringWheelTorque` | `Telemetry.mSteeringArmForce` | N/A | Nm (iR) / N (rF2) | ⚠️ Different physical quantity |

## 3. Tire Data

| Field | iRacing Raw | LMU/rF2 Raw | SimHub Normalized | Conversion Notes |
|-------|------------|-------------|-------------------|-----------------|
| Wear FL | `LFwearL/M/R` avg | `Telemetry.mWheels[0].mWear` | `TyreWearFrontLeft` | rF2: 1=new, 0=worn → invert to match plugin convention |
| Wear FR | `RFwearL/M/R` avg | `Telemetry.mWheels[1].mWear` | `TyreWearFrontRight` | Same inversion |
| Wear RL | `LRwearL/M/R` avg | `Telemetry.mWheels[2].mWear` | `TyreWearRearLeft` | Same inversion |
| Wear RR | `RRwearL/M/R` avg | `Telemetry.mWheels[3].mWear` | `TyreWearRearRight` | Same inversion |
| Temp FL | `LFtempCL/CM/CR` avg | `Telemetry.mWheels[0].mTemperature[0/1/2]` | `TyreTempFrontLeft` | °C, inner/middle/outer |
| Temp FR | `RFtempCL/CM/CR` avg | `Telemetry.mWheels[1].mTemperature[0/1/2]` | `TyreTempFrontRight` | °C |
| Temp RL | `LRtempCL/CM/CR` avg | `Telemetry.mWheels[2].mTemperature[0/1/2]` | `TyreTempRearLeft` | °C |
| Temp RR | `RRtempCL/CM/CR` avg | `Telemetry.mWheels[3].mTemperature[0/1/2]` | `TyreTempRearRight` | °C |
| Pressure FL | `LFpressure` | `Telemetry.mWheels[0].mPressure` | `TyrePressureFrontLeft` | kPa |
| Pressure FR | `RFpressure` | `Telemetry.mWheels[1].mPressure` | `TyrePressureFrontRight` | kPa |

**rF2 Wheel Order:** [0]=FL, [1]=FR, [2]=RL, [3]=RR (same as iRacing convention)

## 4. Driver Aids

| Field | iRacing Raw | LMU/rF2 Raw | SimHub Normalized | Conversion Notes |
|-------|------------|-------------|-------------------|-----------------|
| Brake Bias | `dcBrakeBias` | `Telemetry.mRearBrakeBias` | `BrakeBias` | iRacing: front % (0-100). rF2: rear ratio (0-1). Convert: `(1-rear)*100` |
| TC Setting | `dcTractionControl` | `Telemetry.mTractionControl` | N/A | Both are float; check range |
| ABS Setting | `dcABS` | `Telemetry.mAntiLockBraking` | N/A | ⚠️ Currently NOT mapped for LMU |
| ABS Active | via flag | via threshold | `ElectronicsAbsActive` | Boolean event detection |
| TC Active | via flag | via threshold | `ElectronicsTcActive` | Boolean event detection |

## 5. Session & Scoring

| Field | iRacing Raw | LMU/rF2 Raw | SimHub Normalized | Notes |
|-------|------------|-------------|-------------------|-------|
| Position | `PlayerCarPosition` | `Scoring.mVehicles[player].mPlace` | `Position` | 1-based |
| Lap Count | `Lap` | `Scoring.mVehicles[player].mTotalLaps` | `CurrentLap` | |
| Lap Time | `LapCurrentTime` | computed | `CurrentLapTime` | |
| Best Lap | `LapBestLapTime` | `Scoring.mVehicles[player].mBestLapTime` | `BestLapTime` | |
| Last Lap | `LapLastLapTime` | `Scoring.mVehicles[player].mLastLapTime` | `LastLapTime` | |
| Delta to Best | `LapDeltaToBestLap` | computed | `DeltaToBestLap` | |
| Track Distance | `LapDistPct` | `Scoring.mVehicles[player].mLapDist / mLapDist` | `TrackPositionPercent` | rF2 in meters → divide by track length |
| Laps Remaining | `SessionLapsRemain` | computed from session info | `RemainingLaps` | |
| Fuel Level | `FuelLevel` | `Telemetry.mFuel` | `Fuel` | Liters |
| Incident Count | `PlayerCarMyIncidentCount` | `Scoring.mNumPenalties` | N/A | rF2 = penalties, not incidents |

## 6. Flags

| Flag | iRacing (SessionFlags bitmask) | LMU mGamePhase | LMU mHighestFlagColor | Notes |
|------|-------------------------------|----------------|----------------------|-------|
| Green | 0x0004 | 5 | 1 | Race running |
| Yellow (Full Course) | 0x0008 | 6 | 3 | Safety car / FCY |
| Yellow (Local) | 0x0008 | — | 3 | Per-driver flag |
| Blue | 0x0080 | — | 2 | Being lapped |
| Black | 0x0100 | — | 5 | Penalty / DQ |
| White | 0x0200 | — | 6 | Slow car ahead |
| Red | 0x0040 | 7 (stopped) | 4 | ⚠️ NOT currently mapped! |
| Checkered | 0x0002 | 8 (over) | 7 | ⚠️ NOT currently mapped! |
| Debris | 0x2000 | — | — | No direct rF2 equivalent |

## 7. Pit Lane

| Field | iRacing Raw | LMU/rF2 Raw | SimHub Normalized | Notes |
|-------|------------|-------------|-------------------|-------|
| In Pit Lane | `OnPitRoad` | `Scoring.mVehicles[player].mInPits` | `IsInPitLane` | Boolean |
| Pit Limiter On | `dcPitSpeedLimiterToggle` | `Telemetry.mSpeedLimiter` | `PitLimiterOn` | Boolean |
| Pit Speed Limit | `PitSpeedLimit` (m/s) | ❌ Not directly exposed | N/A | ⚠️ Need hardcoded fallback or series config |
| Pit Fuel Request | `PitSvFuel` (liters) | ❌ Not mapped | N/A | rF2 may not expose pit menu state |
| Pit Tire Pressures | `PitSvLFP/RFP/LRP/RRP` | ❌ Not mapped | N/A | |
| Pit Compound | `PitSvTireCompound` | ❌ Not mapped | N/A | |

## 8. Energy Recovery / Hybrid

| Field | iRacing Raw | LMU/rF2 Raw | SimHub Normalized | Notes |
|-------|------------|-------------|-------------------|-------|
| Battery Level | `EnergyERSBatteryPct` | `Telemetry.mBatteryChargeFraction` | N/A | 0-1 range |
| DRS Status | `DrsStatus` | `Telemetry.mRearFlapLegalStatus` | N/A | 0=none, 1=available, 2=active |
| MGU-K Power | `dcMGUKDeployMode` | varies by car | N/A | Not all LMU cars have hybrid |

## 9. In-Car Adjustments (iRacing dc* Variables)

These are iRacing-specific driver controls. LMU equivalents are partial:

| iRacing Variable | LMU Equivalent | Status |
|-----------------|----------------|--------|
| `dcBrakeBias` | `Telemetry.mRearBrakeBias` (converted) | ✓ Mapped |
| `dcTractionControl` | `Telemetry.mTractionControl` | ✓ Mapped |
| `dcABS` | `Telemetry.mAntiLockBraking` | ❌ NOT mapped |
| `dcAntiRollFront` | Unknown | ❌ Not available |
| `dcAntiRollRear` | Unknown | ❌ Not available |
| `dcEnginePower` | Unknown | ❌ Not available |
| `dcFuelMixture` | Unknown | ❌ Not available |
| `dcWeightJackerLeft` | Unknown | ❌ Not available |
| `dcWeightJackerRight` | Unknown | ❌ Not available |
| `dcWingFront` | Unknown | ❌ Not available |
| `dcWingRear` | Unknown | ❌ Not available |

## 10. Multi-Car / Opponent Data

| Field | iRacing | LMU/rF2 | Notes |
|-------|---------|---------|-------|
| Player Car Index | `PlayerCarIdx` | Find `mIsPlayer==true` in `mVehicles` | |
| Car N Position % | `CarIdxLapDistPct[N]` | `Scoring.mVehicles[N].mLapDist / trackLength` | rF2 in meters |
| Car N In Pits | `CarIdxOnPitRoad[N]` | `Scoring.mVehicles[N].mInPits` | Boolean |
| Car N Laps Done | `CarIdxLapCompleted[N]` | `Scoring.mVehicles[N].mTotalLaps` | |
| Car N Driver Name | Session YAML | `Scoring.mVehicles[N].mDriverName` | |
| Car N Vehicle Name | Session YAML | `Scoring.mVehicles[N].mVehicleName` | |
| Car N Class | Session YAML | `Scoring.mVehicles[N].mVehicleClass` | Multi-class support |
| Number of Cars | Session YAML count | `Scoring.mScoringInfo.mNumVehicles` | |

## 11. Career / Rating (iRacing Only)

| Field | Source | LMU Equivalent |
|-------|--------|---------------|
| iRating | IRacingSdkBridge / YAML | ❌ None — use graceful fallback |
| Safety Rating | IRacingSdkBridge / YAML | ❌ None |
| License Class | IRacingSdkBridge / YAML | ❌ None |
| Incident Limit (Penalty) | IRacingSdkBridge / YAML | ❌ None |
| Incident Limit (DQ) | IRacingSdkBridge / YAML | ❌ None |

## 12. Environment

| Field | iRacing Raw | LMU/rF2 Raw | SimHub Normalized | Notes |
|-------|------------|-------------|-------------------|-------|
| Air Temp | `AirTemp` | `Scoring.mScoringInfo.mAmbientTemp` | `AirTemperature` | °C |
| Track Temp | `TrackTempCrew` | `Scoring.mScoringInfo.mTrackTemp` | `RoadTemperature` | °C |
| Rain | `Precipitation` | `Scoring.mScoringInfo.mRaining` | `RainIntensity` | rF2: 0-1 float |
| Wind Speed | `WindVel` | `Scoring.mScoringInfo.mWind` | N/A | m/s |

---

## SimHub Property Path Quick Reference

When reading raw rF2 properties through SimHub, prepend: `DataCorePlugin.GameRawData.`

Examples:
```
DataCorePlugin.GameRawData.Telemetry.mEngineRPM
DataCorePlugin.GameRawData.Telemetry.mFuel
DataCorePlugin.GameRawData.Scoring.mScoringInfo.mGamePhase
DataCorePlugin.GameRawData.Scoring.mVehicles[0].mLapDist
```

The `GetRaw<T>(pm, path, "DataCorePlugin.GameRawData.")` helper handles the prefix automatically.
