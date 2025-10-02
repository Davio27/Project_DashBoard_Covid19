import os
import requests
import pandas as pd
from datetime import datetime, timedelta

BASE_URL = "https://covid19-brazil-api.now.sh/api/report/v1"

DATA_DIR = "data"
os.makedirs(DATA_DIR, exist_ok=True)
os.makedirs(f"{DATA_DIR}/estados", exist_ok=True)
os.makedirs(f"{DATA_DIR}/paises", exist_ok=True)
os.makedirs(f"{DATA_DIR}/brasil", exist_ok=True)
os.makedirs(f"{DATA_DIR}/historico", exist_ok=True)

def update_from_who():
    url = "https://covid19.who.int/WHO-COVID-19-global-data.csv"
    df = pd.read_csv(url)
    # Filtre e processe (ex: group by country, continent)
    # Adicione continent usando uma lib como pycountry_convert se precisar mapear
    df.to_parquet("data/casos_todos_paises.parquet")  # Sobrescreva
    print("Dados atualizados da WHO!")
    
def save_parquet(data, path):
    """Salva dados em parquet, apenas se não for vazio"""
    if data is None or len(data) == 0:
        return
    df = pd.DataFrame(data if isinstance(data, list) else [data])
    df.to_parquet(path, index=False)


def casos_todos_estados():
    """Lista casos por todos os estados brasileiros"""
    res = requests.get(f"{BASE_URL}").json()
    save_parquet(res.get("data", []), f"{DATA_DIR}/estados/casos_estados.parquet")
    print("✅ Casos por todos estados salvos.")


def casos_estado(uf: str):
    """Lista casos por estado brasileiro"""
    res = requests.get(f"{BASE_URL}/brazil/uf/{uf.lower()}").json()
    save_parquet(res, f"{DATA_DIR}/estados/casos_estado_{uf.upper()}.parquet")
    print(f"✅ Casos por estado ({uf.upper()}) salvos.")


def casos_brasil_data(start="20200318", end="20221231"):
    """Loop em todas as datas desde início até fim da pandemia"""
    start_date = datetime.strptime(start, "%Y%m%d")
    end_date = datetime.strptime(end, "%Y%m%d")

    data_acumulada = []

    while start_date <= end_date:
        data_str = start_date.strftime("%Y%m%d")
        url = f"{BASE_URL}/brazil/{data_str}"
        res = requests.get(url).json()
        registros = res.get("data", [])
        if registros:
            for r in registros:
                r["date"] = data_str
            data_acumulada.extend(registros)
        start_date += timedelta(days=1)

    save_parquet(data_acumulada, f"{DATA_DIR}/historico/casos_brasil_historico.parquet")
    print("✅ Casos históricos do Brasil salvos.")


def casos_pais(pais="brazil"):
    """Lista casos por país"""
    res = requests.get(f"{BASE_URL}/{pais.lower()}").json()
    save_parquet(res.get("data", {}), f"{DATA_DIR}/paises/casos_{pais.lower()}.parquet")
    print(f"✅ Casos por país ({pais}) salvos.")


def casos_todos_paises():
    """Lista casos de todos países"""
    res = requests.get(f"{BASE_URL}/countries").json()
    save_parquet(res.get("data", []), f"{DATA_DIR}/paises/casos_todos_paises.parquet")
    print("✅ Casos por todos os países salvos.")


def status_api():
    """Consulta status da API"""
    res = requests.get("https://covid19-brazil-api.now.sh/api/status/v1").json()
    save_parquet(res, f"{DATA_DIR}/status_api.parquet")
    print("✅ Status da API salvo.")


if __name__ == "__main__":
    print("Extraindo dados Covid19...")

    casos_todos_estados()
    casos_estado("sp")
    casos_brasil_data()  # histórico completo
    casos_pais("brazil")
    casos_todos_paises()
    status_api()

    print("🚀 Extração concluída!")
