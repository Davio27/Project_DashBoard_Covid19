from flask import Flask, render_template, redirect, url_for, request, jsonify
import os
import sys
sys.path.append(os.path.join(os.path.dirname(__file__), 'backend'))
from main import (load_covid_data, get_casos_brasil, get_casos_brasil_historico, get_casos_estados, get_casos_paises, get_covid19_data, get_continente_data)


app = Flask(__name__)

@app.route('/')
def login():
    return render_template('login.html')

@app.route('/dashboard')
def dashboard():
    return render_template('index.html')

@app.route('/login', methods=['POST'])
def handle_login():
    email = request.form.get('email')
    password = request.form.get('password')
    if email and password:
        return redirect(url_for('dashboard'))
    return redirect(url_for('login'))

@app.route('/api/continentes')
def api_continentes():
    return jsonify(get_continente_data())

@app.route('/logout')
def logout():
    return redirect(url_for('login'))

# APIs
@app.route('/api/brasil')
def api_brasil():
    brasil_data = get_casos_brasil()
    return jsonify(brasil_data)



@app.route('/api/brasil/historico')
def api_brasil_historico():
    historico = get_casos_brasil_historico()
    return jsonify(historico)

@app.route('/api/estados')
def api_estados():
    estados = get_casos_estados()
    return jsonify(estados)

@app.route('/api/paises')
def api_paises():
    paises = get_casos_paises()
    return jsonify(paises)

@app.route('/api/covid19')
def api_covid19():
    covid19 = get_covid19_data()
    return jsonify(covid19)

@app.route('/api/municipios/<uf>')
def api_municipios(uf):
    from main import get_casos_municipios
    municipios = get_casos_municipios(uf.upper())
    return jsonify(municipios)


if __name__ == '__main__':
    app.run(debug=True)
