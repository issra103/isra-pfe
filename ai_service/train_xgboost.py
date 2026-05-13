import pandas as pd
import numpy as np
from sklearn.ensemble import RandomForestRegressor
from sklearn.model_selection import train_test_split
from sklearn.metrics import mean_absolute_percentage_error
from xgboost import XGBRegressor
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
zones = ["PowerConsumption_Zone1", "PowerConsumption_Zone2", "PowerConsumption_Zone3"]
frames = []
for zone_id, z in enumerate(zones):
    tmp = df[["Datetime", "Temperature", "Humidity", "WindSpeed",
              "GeneralDiffuseFlows", "DiffuseFlows", z]].copy()
    tmp = tmp.rename(columns={z: "power_w"})
    tmp["zone_id"] = zone_id
    frames.append(tmp)
df_stacked = pd.concat(frames, ignore_index=True)

df_stacked["hour"]        = df_stacked["Datetime"].dt.hour
df_stacked["day_of_week"] = df_stacked["Datetime"].dt.dayofweek
df_stacked["month"]       = df_stacked["Datetime"].dt.month
df_stacked["is_weekend"]  = (df_stacked["day_of_week"] >= 5).astype(int)

FEATURES = ["zone_id", "hour", "day_of_week", "month", "is_weekend",
            "Temperature", "Humidity", "WindSpeed",
            "GeneralDiffuseFlows", "DiffuseFlows"]

X = df_stacked[FEATURES].values
y = df_stacked["power_w"].values

X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.2, random_state=42, shuffle=True
)

results = {}

# ─── 1. Random Forest (référence) ───────────────────────────────────────────────
print("\n[Train] Random Forest Regressor...")
rf = RandomForestRegressor(n_estimators=200, max_depth=15, random_state=42, n_jobs=-1)
rf.fit(X_train, y_train)

y_pred_rf = rf.predict(X_test)
mape_rf   = mean_absolute_percentage_error(y_test, y_pred_rf) * 100
rmse_rf   = np.sqrt(np.mean((y_test - y_pred_rf) ** 2))
results["RandomForest"] = {"model": rf, "mape": mape_rf, "rmse": rmse_rf}
print(f"[RandomForest]  MAPE = {mape_rf:.2f}%  |  RMSE = {rmse_rf:.2f} W")

# ─── 2. XGBoost ─────────────────────────────────────────────────────────────────
print("\n[Train] XGBoost Regressor...")
xgb = XGBRegressor(
    n_estimators=300,
    max_depth=7,
    learning_rate=0.05,
    subsample=0.8,
    colsample_bytree=0.8,
    reg_alpha=0.1,
    reg_lambda=1.0,
    random_state=42,
    n_jobs=-1,
    verbosity=0
)
xgb.fit(X_train, y_train)

y_pred_xgb = xgb.predict(X_test)
mape_xgb   = mean_absolute_percentage_error(y_test, y_pred_xgb) * 100
rmse_xgb   = np.sqrt(np.mean((y_test - y_pred_xgb) ** 2))
results["XGBoost"] = {"model": xgb, "mape": mape_xgb, "rmse": rmse_xgb}
print(f"[XGBoost]       MAPE = {mape_xgb:.2f}%  |  RMSE = {rmse_xgb:.2f} W")

# ─── 3. Comparaison ─────────────────────────────────────────────────────────────
print("\n" + "="*55)
print("  COMPARAISON DES MODELES")
print("="*55)
print(f"  {'Modele':<20} {'MAPE':>8} {'RMSE':>12}")
print("-"*55)
for name, res in results.items():
    print(f"  {name:<20} {res['mape']:>7.2f}%  {res['rmse']:>10.2f} W")
print("="*55)

# ─── 4. Sélection du meilleur ────────────────────────────────────────────────────
best_name  = min(results, key=lambda k: results[k]["mape"])
best_model = results[best_name]["model"]
best_mape  = results[best_name]["mape"]
best_rmse  = results[best_name]["rmse"]

print(f"\n  ✅ Meilleur modele : {best_name}")
print(f"     MAPE = {best_mape:.2f}%  |  RMSE = {best_rmse:.2f} W")

# Sauvegarde du meilleur sous un nom distinct pour ne pas écraser l'original
output_path = f"{MODELS_DIR}/prediction_model_best.pkl"
joblib.dump(best_model, output_path)
joblib.dump({"winner": best_name, "mape": best_mape, "rmse": best_rmse},
            f"{MODELS_DIR}/model_info.pkl")

print(f"\n[Train] Sauvegarde -> {output_path}  ({best_name})")
print("[Train] Le fichier prediction_model.pkl original n'a PAS ete modifie.")
print("\nEntrainement termine.")
