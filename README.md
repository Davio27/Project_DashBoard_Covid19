# Dashboard COVID-19

Bem-vindo ao **Dashboard COVID-19**, uma aplicação web interativa para monitoramento em tempo real de casos, mortes e recuperações relacionados à COVID-19, com foco em dados do Brasil, estados, municípios e países globais. Desenvolvido com Flask no backend e JavaScript (Chart.js e possivelmente D3.js) no frontend, o projeto oferece visualizações dinâmicas, filtros por região/período/estado, um mapa mundial interativo, e um assistente de chat para consultas rápidas.

## Funcionalidades

- **Autenticação Simples**: Tela de login (demo: qualquer email/senha) para acessar o dashboard.
- **Visualizações de Dados**:
  - Gráficos interativos: evolução temporal de casos no Brasil, top 10 países, distribuição por continente e estados.
  - Mapa do Brasil com intensidade de casos por estado.
  - Mapa mundial interativo com métricas configuráveis (casos, mortes, recuperados).
- **Filtros Dinâmicos**:
  - Filtre dados por região (ex.: Brasil, Sudeste, Norte), período (ex.: últimos 30 dias, 3 meses) e estado.
  - Atualização em tempo real dos gráficos e cards com base nos filtros.
- **Chat Assistente**: Respostas pré-definidas para perguntas comuns sobre casos, mortes, e tendências, com integração a uma API de chat.
- **Tema Claro/Escuro**: Alternância de temas com persistência via `localStorage`.
- **Dados Eficientes**: Uso de arquivos Parquet para armazenamento compacto e rápido de dados.

## Tecnologias Utilizadas

- **Backend**: Flask (Python), Pandas, NumPy
- **Frontend**: HTML, CSS (Tailwind-inspired), JavaScript (Chart.js, possivelmente D3.js para mapas)
- **Dados**: Arquivos Parquet na pasta `data/`
- **Deploy**: Render (hospedagem em nuvem)
- **Outros**: localStorage para temas, AJAX para chamadas assíncronas

## Pré-requisitos

- Python 3.8+
- Node.js (opcional, para desenvolvimento frontend)
- Navegador moderno (Chrome, Firefox, etc.)
- Render account (para deploy)

## Instalação

1. **Clone o Repositório**:
   ```bash
   git clone https://github.com/seu-usuario/dashboard-covid19.git
   cd dashboard-covid19
   ```

2. **Crie um Ambiente Virtual**:
   ```bash
   python -m venv venv
   source venv/bin/activate  # Linux/Mac
   venv\Scripts\activate     # Windows
   ```

3. **Instale as Dependências**:
   Crie um arquivo `requirements.txt` com:
   ```
   flask==3.0.3
   pandas==2.2.2
   numpy==1.26.4
   ```
   Instale com:
   ```bash
   pip install -r requirements.txt
   ```

4. **Configure os Arquivos de Dados**:
   - Coloque os arquivos Parquet na pasta `data/` (ex.: `casos_brazil.parquet`, `casos_brasil_historico.parquet`, etc.).
   - Os arquivos são esperados em:
     - `data/casos_brazil.parquet`
     - `data/covid_brasil_historico.parquet`
     - `data/casos_estados_brasil.parquet`
     - `data/casos_todos_paises.parquet`
     - `data/casos_municipios_brasil.parquet`

5. **Execute a Aplicação Localmente**:
   ```bash
   python app.py
   ```
   Acesse em `http://localhost:5000`.

## Estrutura do Projeto

```
dashboard-covid19/
├── data/                    # Arquivos Parquet com dados
│   ├── casos_brazil.parquet
│   ├── casos_brasil_historico.parquet
│   ├── casos_estados_brasil.parquet
│   ├── casos_todos_paises.parquet
│   ├── covid19.parquet
│   ├── casos_municipios_brasil.parquet
├── static/                  # Arquivos estáticos (CSS, JS)
│   ├── styles.css
│   ├── scriptdash.js
│   ├── theme.js
├── templates/               # Templates HTML
│   ├── index.html
│   ├── login.html
├── app.py                   # Aplicação Flask principal
├── main.py                  # Funções de manipulação de dados
├── requirements.txt         # Dependências Python
├── README.md                # Este arquivo
```

## Como Usar

1. **Acesse a Tela de Login**:
   - Abra `http://localhost:5000` (ou a URL do Render).
   - Use qualquer email/senha (modo demo) para entrar.

2. **Navegue no Dashboard**:
   - **Filtros**: Selecione região (ex.: Brasil, Sudeste), período (ex.: últimos 30 dias) e estado no topo.
   - **Gráficos**: Visualize a evolução temporal, distribuição por estados/continentes, e mapa mundial.
   - **Chat**: Clique no botão de chat (canto inferior direito) para perguntas rápidas (ex.: "Qual país tem mais casos?").

3. **Alternar Tema**:
   - Clique no ícone 🌙/☀️ (canto superior direito) para mudar entre claro/escuro.

## Deploy no Render

1. **Crie um Serviço Web no Render**:
   - Acesse [render.com](https://render.com) e crie um novo serviço web.
   - Conecte ao seu repositório Git.

2. **Configure o Ambiente**:
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `gunicorn app:app`
   - **Environment Variables**:
     - `PYTHON_VERSION`: `3.12(venv)` (ou a versão usada)
     - `FLASK_ENV`: `production`

3. **Inclua Arquivos de Dados**:
   - Certifique-se de que a pasta `data/` com os arquivos Parquet está no repositório (não ignore no `.gitignore`).

4. **Acesse**:
   - Após o deploy, acesse a URL fornecida (ex.: `https://seu-app.onrender.com`).

## Problemas Conhecidos

- **Login Simples**: O login é apenas um demo (qualquer email/senha funciona). Para produção, implemente autenticação segura (ex.: Flask-Login).
- **Dados Estáticos**: Os arquivos Parquet precisam ser atualizados manualmente. Considere integrar APIs externas (ex.: WHO, Brasil.io) para dados em tempo real.
- **Performance**: Filtragem de grandes datasets é feita no frontend. Para melhor performance, mova filtros complexos para o backend.

## Contribuindo

1. Faça um fork do repositório.
2. Crie uma branch para sua feature (`git checkout -b feature/nova-funcionalidade`).
3. Commit suas mudanças (`git commit -m 'Adiciona nova funcionalidade'`).
4. Push para a branch (`git push origin feature/nova-funcionalidade`).
5. Abra um Pull Request.

## Licença

Este projeto está licenciado sob a [MIT License](LICENSE).

## Créditos

- **Desenvolvedor**: [Seu Nome]
- **Fontes de Dados**: Organizações de Saúde Mundiais (WHO, Ministério da Saúde, etc.)
- **Ferramentas**: Flask, Pandas, Chart.js, Render

## Contato

Para dúvidas ou sugestões, entre em contato via [seu-email@example.com] ou abra uma issue no repositório.