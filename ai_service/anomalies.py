"""
Historical anomaly batch analysis.
Loads all data from MongoDB, runs Isolation Forest, returns anomalies + stats.
Called by backend via: python anomalies.py
Outputs JSON to stdout.
"""
import json
import sys
import os
import pickle
import numpy as np
from pymongo import MongoClient

MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017/energywatch")
MODEL_PATH = os.path.join(os.path.dirname(__file__), "models", "anomaly_model.pkl")

def main():
    client = MongoClient(MONGO_URI)
    db = client.get_default_database()
    col = db["sensordatas"]

    docs = list(col.find({}, {
        "datetime": 1, "totalConsumption": 1, "consumption_zone1": 1,
        "consumption_zone2": 1, "consumption_zone3": 1, "type_equipement": 1,
        "temperature": 1, "humidity": 1, "is_manual_anomaly": 1,
        "ai_detected_anomaly": 1, "cost_est": 1, "energy_kwh": 1,
    }).sort("datetime", 1))

    if not docs:
        print(json.dumps({"anomalies": [], "all_months": [], "stats": {}}))
        return

    # Load model if available
    model = None
    if os.path.exists(MODEL_PATH):
        with open(MODEL_PATH, "rb") as f:
            model = pickle.load(f)

    anomalies = []
    all_months = {}

    for doc in docs:
        dt = doc.get("datetime")
        if dt is None:
            continue
        month_key = dt.strftime("%Y-%m")
        total = doc.get("totalConsumption", 0)

        if month_key not in all_months:
            all_months[month_key] = {
                "Datetime": f"{month_key}-01",
                "total_consumption": 0,
                "anomaly_count": 0,
                "readings": 0,
            }
        all_months[month_key]["total_consumption"] += total
        all_months[month_key]["readings"] += 1

        is_anomaly = doc.get("ai_detected_anomaly", False) or doc.get("is_manual_anomaly", False)

        # If model available, re-check
        if model is not None:
            features = np.array([[
                total,
                doc.get("temperature", 20),
                doc.get("humidity", 50),
            ]])
            pred = model.predict(features)
            is_anomaly = is_anomaly or (pred[0] == -1)

        if is_anomaly:
            all_months[month_key]["anomaly_count"] += 1
            anomalies.append({
                "Datetime": dt.isoformat(),
                "totalConsumption": total,
                "type_equipement": doc.get("type_equipement", ""),
                "consumption_zone1": doc.get("consumption_zone1", 0),
                "consumption_zone2": doc.get("consumption_zone2", 0),
                "consumption_zone3": doc.get("consumption_zone3", 0),
                "cost_est": doc.get("cost_est", 0),
                "severity": "high" if total > 100000 else "medium" if total > 50000 else "low",
                "source": "ai" if doc.get("ai_detected_anomaly") else "manual",
            })

    sorted_months = sorted(all_months.values(), key=lambda x: x["Datetime"])
    total_anomalies = len(anomalies)
    total_readings = sum(m["readings"] for m in sorted_months)

    result = {
        "anomalies": anomalies,
        "all_months": sorted_months,
        "stats": {
            "total_anomalies": total_anomalies,
            "total_readings": total_readings,
            "anomaly_rate": round(total_anomalies / max(total_readings, 1) * 100, 2),
        },
    }

    print(json.dumps(result, default=str))

if __name__ == "__main__":
    main()
