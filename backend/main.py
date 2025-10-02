import pandas as pd
import numpy as np

# Carregar dados de países
df_paises = pd.read_parquet("data/casos_todos_paises.parquet")

def load_covid_data():
    data = {}
    data["brasil"] = pd.read_parquet("data/casos_brazil.parquet")
    data["brasil_historico"] = pd.read_parquet("data/casos_brasil_historico.parquet")
    data["estados"] = pd.read_parquet("data/casos_estados_brasil.parquet")
    data["paises"] = pd.read_parquet("data/casos_todos_paises.parquet")
    data["covid19"] = pd.read_parquet("data/covid19.parquet")
    return data

def get_casos_municipios(uf):
    df = pd.read_parquet("data/casos_municipios_brasil.parquet")
    df = df[df["UF"] == uf]
    return df.to_dict(orient="records")


def get_casos_brasil():
    df = pd.read_parquet("data/casos_brazil.parquet")
    df['updated_at'] = pd.to_datetime(df['updated_at'])
    latest = df.iloc[-1]
    confirmed = int(latest.get('confirmed', 0) if not pd.isna(latest.get('confirmed')) else 0)
    deaths = int(latest.get('deaths', 0) if not pd.isna(latest.get('deaths')) else 0)
    cases = int(latest.get('cases', confirmed) if not pd.isna(latest.get('cases', confirmed)) else confirmed)
    recovered = int(latest.get('recovered', confirmed - deaths) if not pd.isna(latest.get('recovered', confirmed - deaths)) else (confirmed - deaths))
    return {
        'country': str(latest.get('country', 'Brazil')),
        'confirmed': confirmed,
        'cases': cases,
        'deaths': deaths,
        'recovered': recovered,
        'updated_at': latest['updated_at'].isoformat() if not pd.isna(latest.get('updated_at')) else None
    }

def get_casos_brasil_historico():
    df = pd.read_parquet("data/covid_brazil_historico.parquet")
    df['date'] = pd.to_datetime(df['date'], dayfirst=True, errors="coerce")
    return df.to_dict(orient="records")

def get_continente_data():
    # Agrupar por continente e somar casos confirmados
    df_grouped = df_paises.groupby("continent")["confirmed"].sum().reset_index()
    df_grouped['continent'] = df_grouped['continent'].replace({'North America': 'América', 'South America': 'América'})
    df_grouped = df_grouped.groupby('continent')['confirmed'].sum().reset_index()
    df_grouped = df_grouped[df_grouped['continent'] != 'Antarctica']
    return df_grouped.to_dict(orient="records")

def get_casos_estados():
    df = pd.read_parquet("data/casos_estados_brasil.parquet")
    df['datetime'] = pd.to_datetime(df['datetime'])
    return df.to_dict(orient="records")

def get_casos_paises():
    df = pd.read_parquet("data/casos_todos_paises.parquet")
    df['updated_at'] = pd.to_datetime(df['updated_at'])
    return df.to_dict(orient="records")

def get_covid19_data():
    df = pd.read_parquet("data/covid19.parquet")
    df['last_available_date'] = pd.to_datetime(df['last_available_date'])
    return df.to_dict(orient="records") 