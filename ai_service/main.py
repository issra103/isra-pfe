from fastapi import FastAPI
from pydantic import BaseModel, Field
import joblib
import numpy as np
import os
from pathlib import Path

app = FastAPI(title="EnergyWatch AI Service", version="1.0.0")

# Always resolve relative to this file's location — safe regardless of CWD
MODELS_DIR = Path(__file__).parent / "models"

try:
    anomaly_model    = joblib.load(f"{MODELS_DIR}/anomaly_model.pkl")
    prediction_model = joblib.load(f"{MODELS_DIR}/prediction_model.pkl")
    power_stats      = joblib.load(f"{MODELS_DIR}/power_stats.pkl")
    print("[AI] Modeles charges avec succes")
    print(f"[AI] Stats: mean={power_stats['mean']:.1f}W  p99={power_stats['p99']:.1f}W")
except FileNotFoundError as e:
    raise RuntimeError(f"Modele introuvable : {e}. Lance train.py d'abord.")


class SensorInput(BaseModel):
    power_w:                float = Field(..., gt=0)
    temperature:            float
    humidity:               float = Field(..., ge=0, le=100)
    hour:                   int   = Field(..., ge=0, le=23)
    day_of_week:            int   = Field(..., ge=0, le=6)
    month:                  int   = Field(..., ge=1, le=12)
    wind_speed:             float = Field(default=0.0, ge=0)
    zone_id:                int   = Field(default=0, ge=0, le=2)  # 0=Zone1, 1=Zone2, 2=Zone3
    general_diffuse_flows:  float = Field(default=0.0, ge=0)
    diffuse_flows:          float = Field(default=0.0, ge=0)


@app.post("/predict")
def predict(data: SensorInput):
    # ── 1. Hybrid anomaly detection ──────────────────────────────────────────
    # Rule-based: catch extreme out-of-range values that IF misses
    z_score   = (data.power_w - power_stats["mean"]) / power_stats["std"]
    rule_anomaly = data.power_w > power_stats["p99"] * 3 or z_score > 6

    # ML-based: Isolation Forest for in-range anomalies
    X_anomaly     = np.array([[data.power_w, data.temperature, data.humidity,
                                data.wind_speed, data.general_diffuse_flows, data.diffuse_flows]])
    anomaly_score = float(anomaly_model.decision_function(X_anomaly)[0])
    if_anomaly    = bool(anomaly_model.predict(X_anomaly)[0] == -1)

    is_anomaly = rule_anomaly or if_anomaly

    # Next-hour prediction
    next_hour = (data.hour + 1) % 24
    X_pred = np.array([[
        data.zone_id,
        next_hour,
        data.day_of_week,
        data.month,
        1 if data.day_of_week >= 5 else 0,
        data.temperature,
        data.humidity,
        data.wind_speed,
        data.general_diffuse_flows,
        data.diffuse_flows,
    ]])
    predicted_next_w = float(prediction_model.predict(X_pred)[0])

    return {
        "is_anomaly":       is_anomaly,
        "anomaly_score":    round(anomaly_score, 4),
        "predicted_next_w": round(predicted_next_w, 2),
    }


@app.get("/health")
def health():
    return {"status": "ok", "models_loaded": True}
