import pandas as pd
import numpy as np
from sklearn.ensemble import IsolationForest, RandomForestRegressor
from sklearn.model_selection import train_test_split
from sklearn.metrics import mean_absolute_percentage_error
import joblib
import os
from pathlib import Path

HERE       = Path(__file__).parent
CSV_PATH   = str(HERE.parent / "powerconsumption (12).csv")
MODELS_DIR = str(HERE / "models")
os.makedirs(MODELS_DIR, exist_ok=True)

# ─── Load ───────────────────────────────────────────────────────────────────────
df = pd.read_csv(CSV_PATH, parse_dates=["Datetime"])
df = df.dropna()
print(f"[Train] Dataset charge : {len(df)} lignes")

# ─── Feature engineering ────────────────────────────────────────────────────────
# Stack all 3 zones so the model learns per-zone ranges (one row = one zone reading)
zones = ["PowerConsumption_Zone1", "PowerConsumption_Zone2", "PowerConsumption_Zone3"]
frames = []
for zone_id, z in enumerate(zones):
    tmp = df[["Datetime", "Temperature", "Humidity", "WindSpeed",
              "GeneralDiffuseFlows", "DiffuseFlows", z]].copy()
    tmp = tmp.rename(columns={z: "power_w"})
    tmp["zone_id"] = zone_id   # 0=Zone1, 1=Zone2, 2=Zone3
    frames.append(tmp)
df_stacked = pd.concat(frames, ignore_index=True)

df_stacked["hour"]        = df_stacked["Datetime"].dt.hour
df_stacked["day_of_week"] = df_stacked["Datetime"].dt.dayofweek
df_stacked["month"]       = df_stacked["Datetime"].dt.month
df_stacked["is_weekend"]  = (df_stacked["day_of_week"] >= 5).astype(int)

FEATURES = ["zone_id", "hour", "day_of_week", "month", "is_weekend",
            "Temperature", "Humidity", "WindSpeed",
            "GeneralDiffuseFlows", "DiffuseFlows"]

# ─── 1. Isolation Forest (anomaly detection) ────────────────────────────────────
print("\n[Train] Isolation Forest...")
X_anomaly = df_stacked[["power_w", "Temperature", "Humidity", "WindSpeed",
                         "GeneralDiffuseFlows", "DiffuseFlows"]].values

iso = IsolationForest(n_estimators=100, contamination=0.02, random_state=42)
iso.fit(X_anomaly)
joblib.dump(iso, f"{MODELS_DIR}/anomaly_model.pkl")
print(f"[Train] Sauvegarde -> {MODELS_DIR}/anomaly_model.pkl")

# Save training stats for out-of-range z-score hybrid detection
power_stats = {
    "mean": float(df_stacked["power_w"].mean()),
    "std":  float(df_stacked["power_w"].std()),
    "p99":  float(df_stacked["power_w"].quantile(0.99)),
    "p01":  float(df_stacked["power_w"].quantile(0.01)),
}
joblib.dump(power_stats, f"{MODELS_DIR}/power_stats.pkl")
print(f"[Train] Stats: mean={power_stats['mean']:.1f}W  std={power_stats['std']:.1f}W  p99={power_stats['p99']:.1f}W")

# ─── 2. Random Forest Regressor (prediction) ────────────────────────────────────
print("\n[Train] Random Forest Regressor...")
X = df_stacked[FEATURES].values
y = df_stacked["power_w"].values

X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.2, random_state=42, shuffle=True   # shuffle OK for stacked multi-zone data
)

rf = RandomForestRegressor(n_estimators=200, max_depth=15, random_state=42, n_jobs=-1)
rf.fit(X_train, y_train)

y_pred = rf.predict(X_test)
mape   = mean_absolute_percentage_error(y_test, y_pred) * 100
rmse   = np.sqrt(np.mean((y_test - y_pred) ** 2))

print(f"\n[Resultats]  MAPE = {mape:.2f}%  |  RMSE = {rmse:.2f} W")
joblib.dump(rf, f"{MODELS_DIR}/prediction_model.pkl")
print(f"[Train] Sauvegarde -> {MODELS_DIR}/prediction_model.pkl")
print("\nEntrainement termine.")
