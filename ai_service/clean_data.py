import pandas as pd
import numpy as np
import os
from pathlib import Path

# ─── Configuration des chemins ───────────────────────────────────────────────
HERE = Path(__file__).parent
RAW_CSV_PATH = HERE.parent / "powerconsumption (12).csv"

def data_quality_check():
    # 1. Chargement des données
    if not RAW_CSV_PATH.exists():
        print(f"❌ Erreur : Le fichier {RAW_CSV_PATH} est introuvable.")
        return

    df_raw = pd.read_csv(RAW_CSV_PATH)
    
    print("\n========== DATA QUALITY CHECK ==========")
    
    # Shape avant nettoyage
    print(f"Shape avant nettoyage: {df_raw.shape}")
    
    # Dates invalides (simulation de check)
    df_raw['Datetime'] = pd.to_datetime(df_raw['Datetime'], errors='coerce')
    invalid_dates = df_raw['Datetime'].isna().sum()
    print(f"Dates invalides: {invalid_dates}")
    
    # Nettoyage
    df = df_raw.dropna(subset=['Datetime'])
    df = df.drop_duplicates()
    
    # Shape après suppression dates invalides
    print(f"\nShape après suppression dates invalides: {df.shape}")
    
    # Doublons et Valeurs manquantes totales
    print(f"Doublons: {df_raw.duplicated().sum()}")
    print(f"Valeurs manquantes (total): {df.isna().sum().sum()}")
    
    # Valeurs manquantes par colonne
    print("\nValeurs manquantes par colonne:")
    print(df.isna().sum())
    
    # Types des colonnes
    print("\nTypes des colonnes:")
    print(df.dtypes)
    
    # Période
    if not df.empty:
        start_date = df['Datetime'].min()
        end_date = df['Datetime'].max()
        print(f"\nPériode:")
        print(f"{start_date} -> {end_date}")
    
    print("========================================\n")

if __name__ == "__main__":
    data_quality_check()
