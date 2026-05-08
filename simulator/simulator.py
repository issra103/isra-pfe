import pandas as pd
import numpy as np
import requests
import time
import random
from datetime import datetime, timezone
from pathlib import Path

# ─── Configuration ─────────────────────────────────────────────────────────────
BACKEND_URL  = "http://localhost:4000/api/iot/data"
CSV_PATH     = str(Path(__file__).parent.parent / "powerconsumption (12).csv")
INTERVAL_S   = 10
ANOMALY_RATE = 0.02   # 2% des lignes

def add_noise(value: float, noise_pct: float = 0.05) -> float:
    noise = np.random.normal(0, value * noise_pct)
    return max(0.0, value + noise)

def inject_anomaly(value: float) -> float:
    return value * random.uniform(8, 15)

def build_payload(row: pd.Series) -> dict:
    zone1 = float(row["PowerConsumption_Zone1"])
    zone2 = float(row["PowerConsumption_Zone2"])
    zone3 = float(row["PowerConsumption_Zone3"])

    is_anomaly = random.random() < ANOMALY_RATE
    if is_anomaly:
        zone1 = inject_anomaly(zone1)
        zone2 = inject_anomaly(zone2)
        zone3 = inject_anomaly(zone3)
    else:
        zone1 = add_noise(zone1)
        zone2 = add_noise(zone2)
        zone3 = add_noise(zone3)

    return {
        "datetime":            str(row["Datetime"]),
        "type_equipement":     str(row["type_equipement"]),
        "is_manual_anomaly":   is_anomaly,
        "temperature":         round(float(row["Temperature"]), 3),
        "humidity":            round(float(row["Humidity"]), 1),
        "windSpeed":           round(float(row["WindSpeed"]), 3),
        "generalDiffuseFlows": round(float(row["GeneralDiffuseFlows"]), 3),
        "diffuseFlows":        round(float(row["DiffuseFlows"]), 3),
        "consumption_zone1":   round(zone1, 6),
        "consumption_zone2":   round(zone2, 6),
        "consumption_zone3":   round(zone3, 6),
    }

def run():
    df = pd.read_csv(CSV_PATH)
    print(f"[Simulateur] Dataset charge : {len(df)} lignes")
    print(f"[Simulateur] Envoi vers {BACKEND_URL} toutes les {INTERVAL_S}s\n")

    while True:
        for idx, row in df.iterrows():
            payload = build_payload(row)
            total = payload["consumption_zone1"] + payload["consumption_zone2"] + payload["consumption_zone3"]
            try:
                resp = requests.post(BACKEND_URL, json=payload, timeout=5)
                status = "OK" if resp.status_code == 201 else f"ERR {resp.status_code}"
                anomaly_flag = " [ANOMALIE]" if payload["is_manual_anomaly"] else ""
                print(f"[{payload['datetime']}] {payload['type_equipement']} | "
                      f"{total:.1f} W total | {status}{anomaly_flag}")
            except requests.exceptions.ConnectionError:
                print(f"[ERREUR] Backend inaccessible — ligne {idx}")
            except Exception as e:
                print(f"[ERREUR] {e}")

            time.sleep(INTERVAL_S)

        print("\n[Simulateur] Fin du dataset — redemarrage...\n")

if __name__ == "__main__":
    run()
