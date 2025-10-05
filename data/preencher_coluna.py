import pandas as pd

# Carregar o parquet
df = pd.read_parquet("covid_brazil_historico.parquet")

# Dicionário de mapeamento UF -> Região
uf_para_regiao = {
    # Norte
    "AC": "Norte", "AP": "Norte", "AM": "Norte", "PA": "Norte",
    "RO": "Norte", "RR": "Norte", "TO": "Norte",

    # Nordeste
    "AL": "Nordeste", "BA": "Nordeste", "CE": "Nordeste", "MA": "Nordeste",
    "PB": "Nordeste", "PE": "Nordeste", "PI": "Nordeste", "RN": "Nordeste",
    "SE": "Nordeste",

    # Centro-Oeste
    "DF": "Centro-Oeste", "GO": "Centro-Oeste", "MT": "Centro-Oeste", "MS": "Centro-Oeste",

    # Sudeste
    "ES": "Sudeste", "MG": "Sudeste", "RJ": "Sudeste", "SP": "Sudeste",

    # Sul
    "PR": "Sul", "RS": "Sul", "SC": "Sul"
}

# Criar a nova coluna
df["regiao"] = df["uf"].map(uf_para_regiao)

# Salvar em parquet novamente
df.to_parquet("dados_com_regiao.parquet", index=False)

print("Coluna 'regiao' adicionada com sucesso!")
