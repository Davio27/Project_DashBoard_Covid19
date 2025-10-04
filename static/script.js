let timelineChart, countriesChart, continentChart, weeklyTrendChart, radarChart;
let sortConfig = { key: null, direction: 'asc' };
let globalCountriesData = [];
let globalHistoricoData = [];
let globalEstadosData = [];
let globeContext, globePath, globeProjection;
let globeData = []; // dados parquet /api/paises
let globeLand;      // geometria topojson
let currentMetric = "confirmed"; // métrica inicial
let isLoaded = false; // Flag para carregamento completo

// ----------------- Mapa Mundial Interativo -----------------
function setMetric(metric) {
    currentMetric = metric;
    renderGlobe();
}

document.getElementById("metricFilter").addEventListener("change", (e) => {
    setMetric(e.target.value);
});

// ----------------- Novas helpers para filtro por região + período -----------------

function _parseRowDate(row) {
    // tenta vários campos comumente presentes no parquet
    const ds = row?.date || row?.datetime || row?.updated_at || row?.Date || row?.DATE || '';
    if (!ds) return null;
    const d = new Date(ds);
    if (!isNaN(d)) return d;
    // fallback para dd/mm/yyyy ou dd-mm-yyyy
    const m = ds.match(/(\d{2})[\/\-](\d{2})[\/\-](\d{4})/);
    if (m) return new Date(`${m[3]}-${m[2]}-${m[1]}T00:00:00`);
    return null;
}

function _getLastDateFromData(data) {
    if (!data || data.length === 0) return null;
    let max = null;
    for (const r of data) {
        const d = _parseRowDate(r);
        if (d && (!max || d > max)) max = d;
    }
    if (max) { max.setHours(23, 59, 59, 999); } // pad até o fim do dia
    return max;
}

function _matchesRegion(row, region) {
    if (!region) return true;
    const rn = region.toString().trim().toLowerCase();
    if (rn === 'brasil' || rn === 'brazil') return true;
    const rreg = (row?.regiao || row?.region || row?.region_name || '').toString().trim().toLowerCase();
    return rreg === rn;
}

function filterByRegionAndPeriod(data, region, periodValue) {
    if (!data || data.length === 0) return [];
    const lastDate = _getLastDateFromData(data);
    if (!lastDate) return [];
    let startDate = null;
    if (periodValue && periodValue !== 'full') {
        const days = parseInt(periodValue, 10);
        if (isNaN(days) || days <= 0) {
            startDate = null; // trata como full
        } else {
            startDate = new Date(lastDate);
            // queremos incluir lastDate e incluir exatamente N dias, então subtrai (days - 1)
            startDate.setDate(lastDate.getDate() - (days - 1));
            startDate.setHours(0, 0, 0, 0);
        }
    }
    return data.filter(row => {
        const d = _parseRowDate(row);
        if (!d) return false;
        if (startDate && (d < startDate || d > lastDate)) return false;
        return _matchesRegion(row, region);
    });
}

function calcSums(rows) {
    return rows.reduce((acc, r) => {
        const cases = Number(r?.cases) || 0;
        const deaths = Number(r?.deaths) || 0;
        const suspects = Number(r?.suspects) || 0;
        acc.cases += cases;
        acc.deaths += deaths;
        acc.recovered += (cases - deaths);
        acc.suspects += suspects;
        return acc;
    }, { cases: 0, deaths: 0, recovered: 0, suspects: 0 });
}

function _formatNumberBR(n) {
    return n.toLocaleString('pt-BR');
}

function applyFiltersAndUpdateCards() {
    // ler selects
    const region = document.getElementById('countryFilter')?.value || 'Brasil';
    const period = document.getElementById('periodFilter')?.value || 'full';

    if (!globalHistoricoData || globalHistoricoData.length === 0) {
        console.warn('applyFiltersAndUpdateCards: globalHistoricoData vazio.');
        // fallback: manter contadores como estavam
        return;
    }

    const filtered = filterByRegionAndPeriod(globalHistoricoData, region, period);
    const sums = calcSums(filtered);

    // Atualiza os cartões (formatado)
    const elCases = document.getElementById('totalCases');
    const elDeaths = document.getElementById('totalDeaths');
    const elRecovered = document.getElementById('totalRecovered');
    const elSuspects = document.getElementById('activeCases');

    if (elCases) elCases.textContent = _formatNumberBR(sums.cases);
    if (elDeaths) elDeaths.textContent = _formatNumberBR(sums.deaths);
    if (elRecovered) elRecovered.textContent = _formatNumberBR(sums.recovered);
    if (elSuspects) elSuspects.textContent = _formatNumberBR(sums.suspects);

    // opcional: atualizar timelineChart com o mesmo filtro (se desejar)
    try {
        if (typeof updateTimelineChart === 'function') {
            updateTimelineChart(filtered);
        }
    } catch (e) {
        console.warn('Não foi possível atualizar timelineChart com os dados filtrados.', e);
    }
}

// ----------------- Fim das helpers -----------------

// --- Chart lifecycle helpers (evita "Canvas is already in use") ---
function destroyAllCharts() {
    try {
        [timelineChart, countriesChart, continentChart, weeklyTrendChart, radarChart].forEach(c => {
            if (c && typeof c.destroy === 'function') {
                try { c.destroy(); } catch (e) { console.warn('Erro ao destruir chart:', e); }
            }
        });
    } catch (e) {
        console.warn('destroyAllCharts error', e);
    } finally {
        timelineChart = countriesChart = continentChart = weeklyTrendChart = radarChart = null;
    }
}

async function loadData() {
    try {
        const globalRes = await fetch('/api/brasil');
        const globalData = await globalRes.json();
        if (globalData) updateCounters(globalData);

        const countriesRes = await fetch('/api/paises');
        const countriesData = await countriesRes.json();
        if (countriesData && countriesData.length > 0) {
            globalCountriesData = countriesData;
            updateCountriesChart();
            populateCountryTable();
        }

        const continentesRes = await fetch('/api/continentes');
        const continentesData = await continentesRes.json();
        if (continentesData && continentesData.length > 0) {
            distribuicaoporcontinente(continentesData);
            updateRegionStats(continentesData);
        }


        const estadosRes = await fetch('/api/estados');
        const estadosData = await estadosRes.json();
        if (estadosData && estadosData.length > 0) {
            globalEstadosData = estadosData;
            distribuicaoporestado(globalEstadosData, 'cases'); // Inicializa com casos
            renderBrazilMap('cases');
        } else {
            console.error('Erro: Dados de estados não carregados.');
        }

        const historicoRes = await fetch('/api/brasil/historico');
        const historicoData = await historicoRes.json();
        if (historicoData && historicoData.length > 0) {
            globalHistoricoData = historicoData;
            applyFiltersAndUpdateCards();
            const statesMap = new Map();
            historicoData.forEach(item => {
                if (item.uf && item.state && !statesMap.has(item.uf)) {
                    statesMap.set(item.uf, item.state);
                }
            });
            const states = Array.from(statesMap.entries()).sort((a, b) => a[1].localeCompare(b[1]));
            const stateSelect = document.getElementById('stateFilter');
            stateSelect.innerHTML = '<option value="">Todos os Estados</option>';
            states.forEach(([uf, state]) => {
                const option = document.createElement('option');
                option.value = uf;
                option.textContent = state;
                stateSelect.appendChild(option);
            });

            const estadosRes = await fetch('/api/estados');
            const estadosData = await estadosRes.json();
            if (estadosData && estadosData.length > 0) {
                globalEstadosData = estadosData;
                distribuicaoporestado(globalEstadosData, 'cases'); // gráfico de barras
                renderBrazilMap(); // <-- adiciona essa linha
            } else {
            }
            // Inicializa gráfico com todos os estados
            updateTimelineChart(globalHistoricoData);
            initTimelineChart(globalHistoricoData);
        }
    } catch (error) {
    }
}

// Mapa Mundial
async function initGlobe() {
    const canvas = document.getElementById("globe");
    globeContext = canvas.getContext("2d");
    globeProjection = d3.geoOrthographic().scale(250).translate([canvas.width / 2, canvas.height / 2]);
    globePath = d3.geoPath(globeProjection, globeContext);

    try {
        // carregar geometria mundial (topojson)
        const world = await d3.json("https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json");
        globeLand = topojson.feature(world, world.objects.countries);

        // carregar parquet convertido do backend
        const res = await fetch("/api/paises");
        globeData = await res.json();

        isLoaded = true; // Marca como carregado só após ambos awaits

        // inicializa drag/zoom só após carregado
        d3.select(canvas)
            .call(dragGlobe(globeProjection).on("drag.render", renderGlobe))
            .call(renderGlobe);

        // Adicione redraw automático para eventos comuns pós-refresh
        window.addEventListener('resize', renderGlobe);
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden && isLoaded) {
                renderGlobe();
            }
        });
    } catch (error) {
        isLoaded = false;
    }
}

function setMetric(metric) {
    currentMetric = metric;
    renderGlobe();
}

function renderGlobe() {
    if (!isLoaded || !globeData || globeData.length === 0 || !globeLand) {
        return;
    }
    globeContext.clearRect(0, 0, 800, 600);

    // esfera (oceano)
    globeContext.beginPath();
    globePath({ type: "Sphere" });
    globeContext.fillStyle = "#72aae7ff";
    globeContext.fill();

    // países
    const maxVal = d3.max(globeData, d => +d[currentMetric] || 0) || 1;
    const colorScale = d3.scaleSequential()
        .domain([0, maxVal])
        .interpolator(
            currentMetric === "confirmed" ? d3.interpolateReds :
                currentMetric === "deaths" ? d3.interpolatePurples :
                    d3.interpolateGreens
        );

    globeLand.features.forEach(feature => {
        const countryName = feature.properties.name;
        const row = globeData.find(d => d.country === countryName);
        const value = row ? +row[currentMetric] : 0;

        globeContext.beginPath();
        globePath(feature);
        globeContext.fillStyle = value > 0 ? colorScale(value) : "#cddaadff";
        globeContext.fill();
        globeContext.strokeStyle = "#20201fff";
        globeContext.stroke();
    });

    // borda da esfera
    globeContext.beginPath();
    globePath({ type: "Sphere" });
    globeContext.strokeStyle = "#000000";
    globeContext.stroke();
}

// drag com versor
function dragGlobe(projection) {
    let v0, q0, r0;
    function dragstarted(event) {
        v0 = versor.cartesian(projection.invert([event.x, event.y]));
        q0 = versor(r0 = projection.rotate());
    }
    function dragged(event) {
        const v1 = versor.cartesian(projection.rotate(r0).invert([event.x, event.y]));
        const delta = versor.delta(v0, v1);
        projection.rotate(versor.rotation(versor.multiply(q0, delta)));
        renderGlobe(); // 👈 força redesenho com as cores
    }
    return d3.drag().on("start", dragstarted).on("drag", dragged);
}

// inicializar
initGlobe();

// Fim -----------------------------------------------------------------------------------


function processWeeklyTrend(historico) {
    const weekly = {};
    historico.forEach(curr => {
        const week = new Date(curr.date).getWeek();
        weekly[week] = weekly[week] || { newCases: 0, newDeaths: 0 };
        weekly[week].newCases += curr.cases || curr.confirmed || 0;
        weekly[week].newDeaths += curr.deaths || 0;
    });
    const keys = Object.keys(weekly).sort((a, b) => a - b).slice(-4);
    return {
        labels: keys.map(k => `Sem ${k}`),
        newCases: keys.map(k => weekly[k].newCases),
        newDeaths: keys.map(k => weekly[k].newDeaths)
    };
}

Date.prototype.getWeek = function () {
    const onejan = new Date(this.getFullYear(), 0, 1);
    return Math.ceil((((this - onejan) / 86400000) + onejan.getDay() + 1) / 7);
};

function updateRegionStats(continentesData) {
    const globalTotal = continentesData.reduce((sum, c) => sum + c.confirmed, 0);

    const regions = {
        'america': continentesData.find(c => c.continent === 'América'),
        'europa': continentesData.find(c => c.continent === 'Europe'),
        'asia': continentesData.find(c => c.continent === 'Asia'),
        'africa': continentesData.find(c => c.continent === 'Africa')
    };

    Object.keys(regions).forEach(key => {
        const region = regions[key];
        if (region) {
            const casesM = (region.confirmed / 1000000).toFixed(1) + 'M';
            const percent = ((region.confirmed / globalTotal) * 100).toFixed(0) + '%';
            document.getElementById(`${key}-stats`).innerHTML = `
                <h4 class="font-bold">${key.charAt(0).toUpperCase() + key.slice(1)}</h4>
                <p>${casesM} casos</p>
                <p>${percent} do total mundial</p>
            `;
        }
    });
}

function distribuicaoporestado(data, metric = 'cases') {
    if (!data || data.length === 0) {
        console.warn('Nenhum dado disponível para o gráfico. Dados:', data);
        return;
    }

    let sortedData = [...data].map(d => ({
        ...d,
        value: metric === 'recovered' ? (d.cases - d.deaths) : (d[metric] || 0)
    })).sort((a, b) => b.value - a.value);
    const labels = sortedData.map(d => d.uf);
    const values = sortedData.map(d => d.value);

    // Destruir gráfico existente
    if (weeklyTrendChart) {
        weeklyTrendChart.destroy();
    }
    const canvas = document.getElementById('weeklyTrendChart');
    if (!canvas) {
        console.error('Canvas #weeklyTrendChart não encontrado no DOM.');
        return;
    }
    const ctx = canvas.getContext('2d');
    if (!ctx) {
        console.error('Contexto 2d do canvas não disponível.');
        return;
    }
    const colors = [
        'rgba(255, 99, 133, 1)', // Red
        'rgba(54, 163, 235, 1)', // Blue
        'rgba(255, 207, 86, 1)', // Yellow
        'rgba(75, 192, 192, 1)', // Green
        'rgba(153, 102, 255, 1)', // Purple
        'rgba(255, 160, 64, 1)', // Orange
        'rgba(253, 79, 49, 1)',  // Tomato
        'rgba(144, 238, 144, 1)', // LightGreen
        'rgba(173, 216, 230, 1)', // LightBlue
        'rgba(255, 182, 193, 1)'  // LightPink
    ];

    try {
        const isDarkMode = document.body.classList.contains('dark-theme');
        weeklyTrendChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: metric === 'cases' ? 'Casos Confirmados' :
                        metric === 'deaths' ? 'Total de Mortes' : 'Recuperados',
                    data: values,
                    backgroundColor: labels.map((_, i) => colors[i % colors.length]),
                    borderColor: labels.map((_, i) => colors[i % colors.length].replace('0.6', '1')),
                    borderWidth: 1,
                    borderRadius: 5
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        title: { display: true, text: '# de Casos' },
                        ticks: {
                            callback: value => value.toLocaleString('pt-BR'),
                            color: isDarkMode ? 'white' : '#333' // Branco no dark, cinza escuro no light
                        }
                    },
                    x: {
                        ticks: {
                            autoSkip: false,
                            maxRotation: 45,
                            minRotation: 45,
                            padding: 10,
                            color: isDarkMode ? 'white' : '#333' // Branco no dark, cinza escuro no light
                        }
                    }
                },
                plugins: {
                    legend: { display: true, position: 'top' },
                    tooltip: {
                        enabled: true,
                        callbacks: {
                            label: function (tooltipItem) {
                                // Calcula o total a partir dos dados do gráfico
                                let total = 0;
                                weeklyTrendChart.data.datasets[0].data.forEach(val => total += (val || 0));

                                // Calcula a porcentagem
                                const value = tooltipItem.raw;
                                const percentage = total > 0 ? ((value / total) * 100).toFixed(2) : 0;

                                // Retorna o label com casos e porcentagem
                                return `${tooltipItem.label}: ${value?.toLocaleString('pt-BR') || 'N/A'} (${percentage}%)`;
                            }
                        },
                        position: 'nearest',
                        // Ajustes para tornar o tooltip maior e mais visível
                        backgroundColor: 'rgba(0, 0, 0, 0.9)', // Fundo mais escuro para contraste
                        titleFont: { size: 26, weight: 'bold' }, // Título maior e em negrito
                        bodyFont: { size: 18 }, // Corpo maior
                        padding: 12, // Mais padding interno
                        caretSize: 10, // Aumenta o tamanho da seta
                        cornerRadius: 8, // Bordas mais arredondadas
                        boxPadding: 6, // Espaçamento interno das caixas
                        minWidth: 250, // Largura mínima para evitar que fique muito pequeno
                        displayColors: true,
                        boxRadius: 10
                    }
                },
                barThickness: 20,
                barPercentage: 0.8,
                categoryPercentage: 0.9
            }
        });
    } catch (error) {
        console.error('Erro ao criar o gráfico:', error);
    }
}

function initCharts() {
    // Se já existirem charts, destrói para evitar erro do Chart.js
    if (timelineChart || countriesChart || continentChart || weeklyTrendChart || radarChart) {
        destroyAllCharts();
    }
    const timelineCtx = document.getElementById('timelineChart').getContext('2d');
    timelineChart = new Chart(timelineCtx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [
                {
                    label: 'Casos',
                    data: [],
                    borderColor: '#3b82f6',
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    tension: 0.4,
                    fill: true,
                    pointRadius: 6,
                    pointHoverRadius: 8,
                    borderWidth: 3
                },
                {
                    label: 'Mortes',
                    data: [],
                    borderColor: '#ef4444',
                    backgroundColor: 'rgba(239, 68, 68, 0.1)',
                    tension: 0.4,
                    fill: true,
                    pointRadius: 6,
                    pointHoverRadius: 8,
                    borderWidth: 3
                },
                {
                    label: 'Recuperados',
                    data: [],
                    borderColor: '#10b981',
                    backgroundColor: 'rgba(16, 185, 129, 0.1)',
                    tension: 0.4,
                    fill: true,
                    pointRadius: 6,
                    pointHoverRadius: 8,
                    borderWidth: 3
                },
                {
                    label: 'Suspeitos',
                    data: [],
                    borderColor: '#f59e0b',
                    backgroundColor: 'rgba(245, 158, 11, 0.1)',
                    tension: 0.4,
                    fill: true,
                    pointRadius: 6,
                    pointHoverRadius: 8,
                    borderWidth: 3
                },
                {
                    label: 'Recusas',
                    data: [],
                    borderColor: '#8b5cf6',
                    backgroundColor: 'rgba(139, 92, 246, 0.1)',
                    tension: 0.4,
                    fill: true,
                    pointRadius: 6,
                    pointHoverRadius: 8,
                    borderWidth: 3
                },
                {
                    label: 'Broadcast',
                    data: [],
                    borderColor: '#06b6d4',
                    backgroundColor: 'rgba(6, 182, 212, 0.1)',
                    tension: 0.4,
                    fill: true,
                    pointRadius: 6,
                    pointHoverRadius: 8,
                    borderWidth: 3
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                intersect: false,
                mode: 'index'
            },
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        usePointStyle: true,
                        padding: 20
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    titleColor: 'white',
                    bodyColor: 'white',
                    borderColor: 'rgba(255, 255, 255, 0.1)',
                    borderWidth: 1,
                    cornerRadius: 8,
                    displayColors: true,
                    callbacks: {
                        label: function (context) {
                            return context.dataset.label + ': ' + context.parsed.y.toLocaleString();
                        }
                    },
                    // Ajustes para tornar o tooltip maior e mais visível
                    backgroundColor: 'rgba(0, 0, 0, 0.9)', // Fundo mais escuro para contraste
                    titleFont: { size: 16, weight: 'bold' }, // Título maior e em negrito
                    bodyFont: { size: 10 }, // Corpo maior
                    padding: 12, // Mais padding interno
                    caretSize: 10, // Aumenta o tamanho da seta
                    cornerRadius: 8, // Bordas mais arredondadas
                    boxPadding: 6, // Espaçamento interno das caixas
                    minWidth: 250, // Largura mínima para evitar que fique muito pequeno
                    displayColors: true,
                    boxRadius: 10
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: {
                        color: 'rgba(0, 0, 0, 0.05)'
                    },
                    ticks: {
                        callback: function (value) {
                            return (value / 1000).toFixed(0) + 'K';
                        },
                        // Ajusta a cor dos ticks com base no modo dark
                        color: document.body.classList.contains('dark-theme') ? 'white' : '#333'
                    }
                },
                x: {
                    grid: {
                        display: false
                    },
                    ticks: {
                        // Ajusta a cor dos rótulos do eixo Y
                        color: document.body.classList.contains('dark-theme') ? 'white' : '#333'
                    }
                }
            },
            animation: {
                duration: 2000,
                easing: 'easeInOutQuart'
            }
        }
    });

    const countriesCtx = document.getElementById('countriesChart').getContext('2d');
    countriesChart = new Chart(countriesCtx, {
        type: 'bar',
        data: {
            labels: [],
            datasets: [{
                label: 'Casos Confirmados',
                data: [],
                backgroundColor: [
                    '#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6',
                    '#06b6d4', '#84cc16', '#f97316', '#ec4899', '#6366f1'
                ],
                borderRadius: 8,
                borderSkipped: false
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            indexAxis: 'y',
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    titleColor: 'white',
                    bodyColor: 'white',
                    cornerRadius: 8,
                    callbacks: {
                        label: function (tooltipItem) {
                            // Calcula o total da métrica atual
                            let total = 0;
                            countriesChart.data.datasets[0].data.forEach(val => total += val);

                            // Calcula a porcentagem
                            const percentage = ((tooltipItem.raw / total) * 100).toFixed(1);

                            // Retorna o label com valor e porcentagem
                            return `${tooltipItem.label}: ${tooltipItem.raw.toLocaleString()} ${countriesChart.data.datasets[0].label.toLowerCase()} (${percentage}%)`;
                        }
                    },
                    // Ajustes para tornar o tooltip maior e mais visível
                    backgroundColor: 'rgba(0, 0, 0, 0.9)', // Fundo mais escuro para contraste
                    titleFont: { size: 26, weight: 'bold' }, // Título maior e em negrito
                    bodyFont: { size: 18 }, // Corpo maior
                    padding: 12, // Mais padding interno
                    caretSize: 10, // Aumenta o tamanho da seta
                    cornerRadius: 8, // Bordas mais arredondadas
                    boxPadding: 6, // Espaçamento interno das caixas
                    minWidth: 250, // Largura mínima para evitar que fique muito pequeno
                    displayColors: true,
                    boxRadius: 20
                }
            },
            scales: {
                x: {
                    beginAtZero: true,
                    grid: {
                        color: 'rgba(0, 0, 0, 0.05)'
                    },
                    ticks: {
                        callback: function (value) {
                            return (value / 1000000).toFixed(1) + 'M';
                        },
                        // Ajusta a cor dos ticks com base no modo dark
                        color: document.body.classList.contains('dark-theme') ? 'white' : '#333'
                    }
                },
                y: {
                    grid: {
                        display: false
                    },
                    ticks: {
                        // Ajusta a cor dos rótulos do eixo Y
                        color: document.body.classList.contains('dark-theme') ? 'white' : '#333'
                    }
                }
            },
            animation: {
                duration: 1500,
                easing: 'easeOutBounce'
            }
        }
    });

    const continentCtx = document.getElementById('continentChart').getContext('2d');
    continentChart = new Chart(continentCtx, {
        type: 'pie',
        data: {
            labels: [],
            datasets: [{
                data: [],
                backgroundColor: [], // Será preenchido dinamicamente
                hoverOffset: 4
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    position: 'right',
                    labels: {
                        pointStyle: 'circle',
                        usePointStyle: true,
                        boxWidth: 10,
                        boxHeight: 10,
                        padding: 10
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function (tooltipItem) {
                            // Calcula o total de casos
                            let total = 0;
                            continentChart.data.datasets[0].data.forEach(val => total += val);

                            // Calcula a porcentagem
                            const percentage = ((tooltipItem.raw / total) * 100).toFixed(1);

                            // Retorna o label com casos e porcentagem
                            return `${tooltipItem.label}: ${tooltipItem.raw.toLocaleString()} casos (${percentage}%)`;
                        }
                    },
                    // Ajustes para tornar o tooltip maior e mais visível
                    backgroundColor: 'rgba(0, 0, 0, 0.9)', // Fundo mais escuro para contraste
                    titleFont: { size: 20, weight: 'bold' }, // Título maior e em negrito
                    bodyFont: { size: 14 }, // Corpo maior
                    padding: 12, // Mais padding interno
                    caretSize: 10, // Aumenta o tamanho da seta
                    cornerRadius: 8, // Bordas mais arredondadas
                    boxPadding: 6, // Espaçamento interno das caixas
                    minWidth: 250, // Largura mínima para evitar que fique muito pequeno
                    displayColors: true,
                    boxRadius: 20
                }
            }
        }
    });

    weeklyTrendChart = new Chart(document.getElementById('weeklyTrendChart').getContext('2d'), {
        type: 'line',
        data: {
            labels: [],
            datasets: [
                {
                    label: 'Novos Casos',
                    data: [],
                    borderColor: '#3b82f6',
                    backgroundColor: 'rgba(59, 130, 246, 0.2)',
                    fill: true,
                    tension: 0.4,
                    pointRadius: 8,
                    pointHoverRadius: 10
                },
                {
                    label: 'Novas Mortes',
                    data: [],
                    borderColor: '#ef4444',
                    backgroundColor: 'rgba(239, 68, 68, 0.2)',
                    fill: true,
                    tension: 0.4,
                    pointRadius: 8,
                    pointHoverRadius: 10
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        pointStyle: 'circle',
                        usePointStyle: true,
                        boxWidth: 20,
                        boxHeight: 20,
                        padding: 20
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    titleColor: 'white',
                    bodyColor: 'white',
                    cornerRadius: 8
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: {
                        color: 'rgba(0, 0, 0, 0.05)'
                    },
                    ticks: {
                        callback: function (value) {
                            return (value / 1000).toFixed(0) + 'K';
                        }
                    }
                },
                x: {
                    grid: {
                        color: 'rgba(0, 0, 0, 0.05)'
                    }
                }
            },
            animation: {
                duration: 2000,
                easing: 'easeInOutQuart'
            }
        }
    });
}

function updateCounters(globalData) {
    document.getElementById('totalCases').textContent = _formatNumberBR(globalData.confirmed);
    document.getElementById('totalDeaths').textContent = _formatNumberBR(globalData.deaths);
    document.getElementById('totalRecovered').textContent = _formatNumberBR(globalData.confirmed - globalData.deaths);
    // document.getElementById('activeCases').textContent = _formatNumberBR(globalData.suspects);
}

function updateCountriesChart() {
    const metric = document.getElementById('chartMetric').value;
    let data, label, colors;

    // Ordena os países com base na métrica selecionada (decrescente)
    const sortedCountries = globalCountriesData.sort((a, b) => {
        let valueA, valueB;
        switch (metric) {
            case 'cases':
                valueA = a.confirmed || 0;
                valueB = b.confirmed || 0;
                break;
            case 'deaths':
                valueA = a.deaths || 0;
                valueB = b.deaths || 0;
                break;
            case 'recovered':
                valueA = a.recovered || (a.confirmed - a.deaths) || 0;
                valueB = b.recovered || (b.confirmed - b.deaths) || 0;
                break;
            case 'mortality':
                valueA = a.cases * 100 || 0;
                valueB = b.cases * 100 || 0;
                break;
        }
        return valueB - valueA; // Decrescente
    }).slice(0, 10).map(c => ({
        ...c,
        flag: c.flag || '🌍'
    }));

    // Define os dados da métrica
    switch (metric) {
        case 'cases':
            data = sortedCountries.map(country => country.confirmed || 0);
            label = 'Casos Confirmados';
            colors = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#06b6d4', '#84cc16', '#f97316', '#ec4899', '#6366f1'];
            break;
        case 'deaths':
            data = sortedCountries.map(country => country.deaths || 0);
            label = 'Total de Mortes';
            colors = Array(10).fill('#ef4444');
            break;
        case 'recovered':
            data = sortedCountries.map(country => country.recovered || (country.confirmed - country.deaths) || 0);
            label = 'Recuperados (Estimado)';
            colors = Array(10).fill('#10b981');
            break;
        case 'mortality':
            data = sortedCountries.map(country => (country.cases * 100).toFixed(2) || 0);
            label = 'Taxa de Mortalidade (%)';
            colors = Array(10).fill('#f59e0b');
            break;
    }

    countriesChart.data.labels = sortedCountries.map(country => country.flag + ' ' + country.country);
    countriesChart.data.datasets[0].data = data;
    countriesChart.data.datasets[0].label = label;
    countriesChart.data.datasets[0].backgroundColor = colors;
    countriesChart.update();
}

// ----------------------------------------------------------------------------------------------------------------------------------

// function initCountriesChart() {
//     const countriesCtx = document.getElementById('countriesChart').getContext('2d');
//     if (!countriesCtx) {
//         console.error('Contexto do canvas #countriesChart não encontrado.');
//         return;
//     }
//     countriesChart = new Chart(countriesCtx, {
//         type: 'bar',
//         data: {
//             labels: [],
//             datasets: [{
//                 label: 'Casos Confirmados',
//                 data: [],
//                 backgroundColor: [
//                     '#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6',
//                     '#06b6d4', '#84cc16', '#f97316', '#ec4899', '#6366f1'
//                 ],
//                 borderRadius: 8,
//                 borderSkipped: false
//             }]
//         },
//         options: {
//             responsive: true,
//             maintainAspectRatio: false,
//             indexAxis: 'y',
//             plugins: {
//                 legend: { display: false },
//                 tooltip: {
//                     backgroundColor: 'rgba(0, 0, 0, 0.8)',
//                     titleColor: 'white',
//                     bodyColor: 'white',
//                     cornerRadius: 8,
//                     callbacks: {
//                         label: function (tooltipItem) {
//                             let total = 0;
//                             countriesChart.data.datasets[0].data.forEach(val => total += val);
//                             const percentage = ((tooltipItem.raw / total) * 100).toFixed(1);
//                             return `${tooltipItem.label}: ${tooltipItem.raw.toLocaleString()} ${countriesChart.data.datasets[0].label.toLowerCase()} (${percentage}%)`;
//                         }
//                     },
//                     backgroundColor: 'rgba(0, 0, 0, 0.9)',
//                     titleFont: { size: 26, weight: 'bold' },
//                     bodyFont: { size: 18 },
//                     padding: 12,
//                     caretSize: 10,
//                     cornerRadius: 8,
//                     boxPadding: 6,
//                     minWidth: 250,
//                     displayColors: true,
//                     boxRadius: 20
//                 }
//             },
//             scales: {
//                 x: {
//                     beginAtZero: true,
//                     grid: { color: 'rgba(0, 0, 0, 0.05)' },
//                     ticks: {
//                         callback: function (value) { return (value / 1000000).toFixed(1) + 'M'; },
//                         color: document.body.classList.contains('dark-theme') ? 'white' : '#333'
//                     }
//                 },
//                 y: {
//                     grid: { display: false },
//                     ticks: { color: document.body.classList.contains('dark-theme') ? 'white' : '#333' }
//                 }
//             },
//             animation: { duration: 1500, easing: 'easeOutBounce' }
//         }
//     });
//     // Atualiza com os dados atuais após inicialização
//     if (globalCountriesData.length > 0) {
//         const chartMetricSelect = document.getElementById('chartMetric');
//         const currentMetric = chartMetricSelect ? chartMetricSelect.value : 'cases';
//         updateCountriesChart();
//     }
// }

function initTimelineChart(historicoData) {
    const timelineCtx = document.getElementById('timelineChart').getContext('2d');
    if (!timelineCtx) {
        console.error('Contexto do canvas #timelineChart não encontrado.');
        return;
    }
    timelineChart = new Chart(timelineCtx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [
                { label: 'Casos', data: [], borderColor: '#3b82f6', backgroundColor: 'rgba(59, 130, 246, 0.1)', tension: 0.4, fill: true, pointRadius: 6, pointHoverRadius: 8, borderWidth: 3 },
                { label: 'Mortes', data: [], borderColor: '#ef4444', backgroundColor: 'rgba(239, 68, 68, 0.1)', tension: 0.4, fill: true, pointRadius: 6, pointHoverRadius: 8, borderWidth: 3 },
                { label: 'Recuperados', data: [], borderColor: '#10b981', backgroundColor: 'rgba(16, 185, 129, 0.1)', tension: 0.4, fill: true, pointRadius: 6, pointHoverRadius: 8, borderWidth: 3 },
                { label: 'Suspeitos', data: [], borderColor: '#f59e0b', backgroundColor: 'rgba(245, 158, 11, 0.1)', tension: 0.4, fill: true, pointRadius: 6, pointHoverRadius: 8, borderWidth: 3 },
                { label: 'Recusas', data: [], borderColor: '#8b5cf6', backgroundColor: 'rgba(139, 92, 246, 0.1)', tension: 0.4, fill: true, pointRadius: 6, pointHoverRadius: 8, borderWidth: 3 },
                { label: 'Broadcast', data: [], borderColor: '#06b6d4', backgroundColor: 'rgba(6, 182, 212, 0.1)', tension: 0.4, fill: true, pointRadius: 6, pointHoverRadius: 8, borderWidth: 3 }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { intersect: false, mode: 'index' },
            plugins: {
                legend: { position: 'bottom', labels: { usePointStyle: true, padding: 20 } },
                tooltip: {
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    titleColor: 'white',
                    bodyColor: 'white',
                    borderColor: 'rgba(255, 255, 255, 0.1)',
                    borderWidth: 1,
                    cornerRadius: 8,
                    displayColors: true,
                    callbacks: { label: context => `${context.dataset.label}: ${context.parsed.y.toLocaleString()}` },
                    backgroundColor: 'rgba(0, 0, 0, 0.9)',
                    titleFont: { size: 16, weight: 'bold' },
                    bodyFont: { size: 10 },
                    padding: 12,
                    caretSize: 10,
                    cornerRadius: 8,
                    boxPadding: 6,
                    minWidth: 250,
                    displayColors: true,
                    boxRadius: 10
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: { color: 'rgba(0, 0, 0, 0.05)' },
                    ticks: {
                        callback: value => (value / 1000).toFixed(0) + 'K',
                        color: document.body.classList.contains('dark-theme') ? 'white' : '#333'
                    }
                },
                x: {
                    grid: { display: false },
                    ticks: { color: document.body.classList.contains('dark-theme') ? 'white' : '#333' }
                }
            },
            animation: { duration: 2000, easing: 'easeInOutQuart' }
        }
    });
    // Atualiza com os dados atuais após inicialização
    updateTimelineChart(historicoData);
}

// ----------------------------------------------------------------------------------------------------------------------------------

function distribuicaoporcontinente(data) {
    const labels = data.map(c => c.continent);
    const values = data.map(c => c.confirmed);
    const colors = {
        'América': '#3b82f6',
        'Europe': '#10b981',
        'Asia': '#f59e0b',
        'Africa': '#8b5cf6',
        'Oceania': '#ef4444',
        // Adicione mais se precisar
    };

    continentChart.data.labels = labels;
    continentChart.data.datasets[0].data = values;
    continentChart.data.datasets[0].backgroundColor = labels.map(label => colors[label] || '#6b7280'); // Cor default
    continentChart.update();
}

function updateTimelineChart(historicoData) {
    const selectedState = document.getElementById('stateFilter')?.value || '';

    let filteredData = [...historicoData]; // agora usa o que foi passado (filtrado por região/período)

    if (selectedState && selectedState !== '') {
        // se escolher estado, ignora o filtro e usa o histórico global completo
        filteredData = globalHistoricoData.filter(item => item.uf === selectedState);
    }

    if (filteredData.length === 0) {
        console.warn("Sem dados para atualizar o gráfico.");
        return;
    }

    // agrupa por data
    const df = filteredData.reduce((acc, curr) => {
        const date = new Date(curr.date).toISOString().split('T')[0];
        if (!acc[date]) {
            acc[date] = { cases: 0, deaths: 0, recovered: 0, suspects: 0 };
        }
        acc[date].cases += curr.cases || 0;
        acc[date].deaths += curr.deaths || 0;
        acc[date].recovered += (curr.cases || 0) - (curr.deaths || 0);
        acc[date].suspects += curr.suspects || 0;
        return acc;
    }, {});

    const labels = Object.keys(df).sort();
    timelineChart.data.labels = labels;
    timelineChart.data.datasets[0].data = labels.map(d => df[d].cases);
    timelineChart.data.datasets[1].data = labels.map(d => df[d].deaths);
    timelineChart.data.datasets[2].data = labels.map(d => df[d].recovered);
    timelineChart.data.datasets[3].data = labels.map(d => df[d].suspects);

    timelineChart.update();
}

async function renderBrazilMap(metric = 'cases') {
    try {
        const geoJsonUrl = 'https://raw.githubusercontent.com/codeforamerica/click_that_hood/master/public/data/brazil-states.geojson';
        const geoData = await fetch(geoJsonUrl).then(res => res.json());
        currentMetric = metric;

        // Mapeia dados do estado
        const valuesByUf = {};
        globalEstadosData.forEach(d => {
            valuesByUf[d.uf] = d[metric] || 0;
        });

        const maxValue = Math.max(...Object.values(valuesByUf), 0);

        // limpa render anterior
        d3.select("#brazilMap").selectAll("*").remove();

        // pega o tamanho do container pai
        const container = document.querySelector("#brazilMap").parentElement;
        const width = container.clientWidth;
        const height = container.clientHeight;

        // cria o svg com viewBox para responsividade
        const svg = d3.select("#brazilMap")
            .attr("viewBox", `0 0 ${width} ${height}`)
            .attr("preserveAspectRatio", "xMidYMid meet");

        // cria um grupo "g" para poder aplicar zoom e pan nele
        const g = svg.append("g");

        const projection = d3.geoMercator()
            .center([-50, -15])
            .scale(width * 2)
            .translate([width / 2, height / 2]);

        const path = d3.geoPath().projection(projection);

        let colorScale;
        if (metric === "cases") {
            // Casos: vermelho
            colorScale = d3.scaleLinear()
                .domain([0, maxValue])
                .range(["#ffcccc", "#ff0000"]);
        } else if (metric === "deaths") {
            // Mortes: roxo
            colorScale = d3.scaleLinear()
                .domain([0, maxValue])
                .range(["#e0ccff", "#8000ff"]);
        }

        const total = globalEstadosData.reduce((acc, d) => acc + (d[metric] || 0), 0);

        // desenha os estados dentro do grupo "g"
        g.selectAll("path")
            .data(geoData.features)
            .enter()
            .append("path")
            .attr("class", "estado")
            .attr("d", path)
            .attr("fill", d => colorScale(valuesByUf[d.properties.sigla] || 0))
            .attr("stroke", "#fff")
            .attr("stroke-width", 1)
            .on("mouseover", function (event, d) {
                d3.select(this).attr("stroke-width", 2);
                const uf = d.properties.sigla;
                const val = valuesByUf[uf] || 0;
                const percentage = total > 0 ? ((val / total) * 100).toFixed(2) : 0;
                tooltip.text(`${uf}: ${val.toLocaleString()} (${percentage}%)`)
                    .style("left", (event.pageX + 10) + "px")
                    .style("top", (event.pageY - 20) + "px")
                    .style("display", "block");
            })
            .on("mouseout", function () {
                d3.select(this).attr("stroke-width", 1);
                tooltip.style("display", "none");
            })
            .on("click", async function (event, d) {
                const uf = d.properties.sigla;
                await abrirMunicipioModal(uf);
            });

        const initialScale = 0.4;
        const zoom = d3.zoom()
            .scaleExtent([initialScale, 8])
            .on("zoom", (event) => {
                g.attr("transform", event.transform);
            });

        svg.call(zoom);
        svg.call(
            zoom.transform,
            d3.zoomIdentity
                .translate(width / 2, height / 2)
                .scale(initialScale)
                .translate(-width / 2, -height / 2)
        );

        let tooltip = d3.select("body").append("div")
            .attr("class", "tooltip")
            .style("position", "absolute")
            .style("background", document.body.classList.contains('dark-theme') ? '#333' : 'white')
            .style("color", document.body.classList.contains('dark-theme') ? 'white' : '#333')
            .style("border", "1px solid #ccc")
            .style("padding", "5px")
            .style("border-radius", "4px")
            .style("pointer-events", "none")
            .style("z-index", "1000")
            .style("display", "none");
    } catch (error) {
        console.error('Erro ao criar o mapa do Brasil:', error);
    }
}

async function abrirMunicipioModal(uf) {
    try {
        const res = await fetch(`/api/municipios/${uf}`);
        let municipios = await res.json();
        window.municipiosData = municipios;
        document.getElementById("municipiosTitle").textContent = `Municípios de ${uf}`;
        renderMunicipiosTable(municipios);
        document.getElementById("municipiosModal").classList.remove("hidden");
    } catch (error) {
        console.error("Erro ao carregar municípios:", error);
    }
}

function closeMunicipiosModal() {
    document.getElementById("municipiosModal").classList.add("hidden");
}

// Renderiza tabela
function renderMunicipiosTable(data) {
    const tbody = document.getElementById("municipiosTableBody");
    tbody.innerHTML = "";
    data.forEach(m => {
        const row = document.createElement("tr");
        row.innerHTML = `
            <td class="px-4 py-2 border-b">${m.municipio}</td>
            <td class="px-4 py-2 border-b">${m.populacao.toLocaleString("pt-BR")}</td>
            <td class="px-4 py-2 border-b">${m.cases.toLocaleString("pt-BR")}</td>
            <td class="px-4 py-2 border-b">${m.deaths.toLocaleString("pt-BR")}</td>
        `;
        tbody.appendChild(row);
    });
}


document.getElementById("municipiosSearch").addEventListener("input", function () {
    const query = this.value.toLowerCase();
    const filtered = window.municipiosData.filter(m => m.municipio.toLowerCase().includes(query));
    renderMunicipiosTable(filtered);
});


let currentPage = 1;
const rowsPerPage = 10;

function sortTable(key) {
    if (sortConfig.key === key) {
        sortConfig.direction = sortConfig.direction === 'asc' ? 'desc' : 'asc';
    } else {
        sortConfig.key = key;
        sortConfig.direction = 'asc';
    }

    const thElements = document.querySelectorAll('#countryTable th');
    thElements.forEach(th => {
        th.classList.remove('sorted-asc', 'sorted-desc');
        if (th.getAttribute('data-sort') === key) {
            th.classList.add(`sorted-${sortConfig.direction}`);
        }
    });

    populateCountryTable();
}

function populateCountryTable() {
    const tableBody = document.getElementById('countryTableBody');
    if (!tableBody || !globalCountriesData || globalCountriesData.length === 0) {
        console.error('Tabela ou dados não encontrados:', { tableBody, globalCountriesData });
        return;
    }

    tableBody.innerHTML = ''; // Limpa a tabela

    // Cria uma cópia dos dados para ordenação
    let sortedCountries = [...globalCountriesData].sort((a, b) => {
        let valueA, valueB;
        switch (sortConfig.key) {
            case 'country':
                valueA = a.country.toLowerCase();
                valueB = b.country.toLowerCase();
                return sortConfig.direction === 'asc' ? valueA.localeCompare(valueB) : valueB.localeCompare(valueA);
            case 'confirmed':
                valueA = a.confirmed || 0;
                valueB = b.confirmed || 0;
                return sortConfig.direction === 'asc' ? valueA - valueB : valueB - valueA;
            case 'deaths':
                valueA = a.deaths || 0;
                valueB = b.deaths || 0;
                return sortConfig.direction === 'asc' ? valueA - valueB : valueB - valueA;
            case 'recovered':
                valueA = a.recovered || (a.confirmed - a.deaths) || 0;
                valueB = b.recovered || (b.confirmed - b.deaths) || 0;
                return sortConfig.direction === 'asc' ? valueA - valueB : valueB - valueA;
            case 'mortality':
                valueA = a.cases * 100 || 0;
                valueB = b.cases * 100 || 0;
                return sortConfig.direction === 'asc' ? valueA - valueB : valueB - valueA;
            default:
                return 0;
        }
    });

    // Aplica paginação
    const startIndex = (currentPage - 1) * rowsPerPage;
    const endIndex = startIndex + rowsPerPage;
    const paginatedCountries = sortedCountries.slice(startIndex, endIndex);

    // Preenche a tabela
    paginatedCountries.forEach(country => {
        const row = document.createElement('tr');
        const mortalityRate = (country.cases * 100).toFixed(2);

        row.innerHTML = `
            <td class="px-6 py-4">${country.flag || '🌍'} ${country.country}</td>
            <td class="px-6 py-4">${country.confirmed?.toLocaleString() || 'N/A'}</td>
            <td class="px-6 py-4">${country.deaths?.toLocaleString() || 'N/A'}</td>
            <td class="px-6 py-4">${country.recovered?.toLocaleString() || 'N/A'}</td>
            <td class="px-6 py-4">${mortalityRate}%</td>
        `;
        tableBody.appendChild(row);
    });

    // Atualiza a paginação
    const totalItems = sortedCountries.length;
    const totalPages = Math.ceil(totalItems / rowsPerPage);
    updatePagination(totalPages, totalItems);
}

function updatePagination(totalPages, totalItems) {
    const paginationDiv = document.createElement('div');
    paginationDiv.className = 'flex justify-center mt-4 space-x-2';

    const current = currentPage;
    const maxPagesToShow = 5;
    let startPage = Math.max(1, current - Math.floor(maxPagesToShow / 2));
    let endPage = Math.min(totalPages, startPage + maxPagesToShow - 1);

    if (endPage - startPage < maxPagesToShow - 1) {
        startPage = Math.max(1, endPage - maxPagesToShow + 1);
    }

    // Botão Previous
    if (current > 1) {
        const prevButton = document.createElement('button');
        prevButton.textContent = 'Anterior';
        prevButton.className = 'px-3 py-1 bg-gray-200 rounded hover:bg-gray-300';
        prevButton.onclick = () => {
            currentPage--;
            populateCountryTable();
        };
        paginationDiv.appendChild(prevButton);
    }

    // Números de página
    for (let i = startPage; i <= endPage; i++) {
        const pageButton = document.createElement('button');
        pageButton.textContent = i;
        pageButton.className = `px-3 py-1 rounded ${i === current ? 'bg-blue-500 text-white' : 'bg-gray-200 hover:bg-gray-300'}`;
        if (i !== current) {
            pageButton.onclick = () => {
                currentPage = i;
                populateCountryTable();
            };
        }
        paginationDiv.appendChild(pageButton);
    }

    // Botão Next
    if (current < totalPages) {
        const nextButton = document.createElement('button');
        nextButton.textContent = 'Próximo';
        nextButton.className = 'px-3 py-1 bg-gray-200 rounded hover:bg-gray-300';
        nextButton.onclick = () => {
            currentPage++;
            populateCountryTable();
        };
        paginationDiv.appendChild(nextButton);
    }

    // Adiciona informações de total
    const infoDiv = document.createElement('div');
    infoDiv.className = 'text-sm text-gray-600 mt-2';
    infoDiv.textContent = `Exibindo ${Math.min((current - 1) * rowsPerPage + 1, totalItems)} - ${Math.min(current * rowsPerPage, totalItems)} de ${totalItems} países`;

    const paginationContainer = document.getElementById('paginationContainer') || document.createElement('div');
    paginationContainer.id = 'paginationContainer';
    paginationContainer.innerHTML = '';
    paginationContainer.appendChild(paginationDiv);
    paginationContainer.appendChild(infoDiv);

    // Adiciona ou atualiza o container de paginação no DOM
    const tableSection = document.querySelector('.detailed-country-data');
    if (tableSection) {
        tableSection.appendChild(paginationContainer);
    } else {
        document.querySelector('.grid-container').appendChild(paginationContainer);
    }
}
// Chama a função ao carregar o DOM
document.addEventListener('DOMContentLoaded', function () {
    loadSavedTheme();

    if (document.getElementById('countryTable')) {
        const thElements = document.querySelectorAll('#countryTable th');
        thElements.forEach(th => {
            th.addEventListener('click', () => sortTable(th.getAttribute('data-sort')));
        });

        initCharts();
        loadData().then(() => {
            if (globalEstadosData.length > 0) {
                distribuicaoporestado(globalEstadosData, 'cases');
                renderBrazilMap('cases'); // inicia com Casos Confirmados
            }

            if (globalCountriesData.length > 0) {
                updateCountriesChart();
                populateCountryTable();
            }

            if (globalHistoricoData.length > 0) {
                initTimelineChart(globalHistoricoData); // garante render inicial
            }

            // não use continentesData aqui, já está tratado em loadData()
        }).catch(error => console.error('Erro em loadData:', error));
    }

    const stateFilter = document.getElementById('stateFilter');
    if (stateFilter) {
        stateFilter.addEventListener('change', () => {
            updateTimelineChart(globalHistoricoData);
        });
    }

    const weeklyMetricSelect = document.getElementById('weeklyMetric');
    if (weeklyMetricSelect) {
        weeklyMetricSelect.addEventListener('change', (e) => {
            distribuicaoporestado(globalEstadosData, e.target.value);
        });
    }
});


function toggleDataset(type) {
    let datasetIndex;
    switch (type) {
        case 'cases':
            datasetIndex = 0;
            break;
        case 'deaths':
            datasetIndex = 1;
            break;
        case 'recovered':
            datasetIndex = 2;
            break;
        case 'suspects':
            datasetIndex = 3;
            break;
    }
    const meta = timelineChart.getDatasetMeta(datasetIndex);
    meta.hidden = meta.hidden === null ? !timelineChart.data.datasets[datasetIndex].hidden : null;
    timelineChart.update();

    const button = document.getElementById('toggle' + type.charAt(0).toUpperCase() + type.slice(1));
    if (meta.hidden) {
        button.style.opacity = '0.5';
        button.style.textDecoration = 'line-through';
    } else {
        button.style.opacity = '1';
        button.style.textDecoration = 'none';
    }
}

function updateDashboard(e) {
    // pega o botão de forma robusta (compatível com onclick inline)
    const button = e?.target || window.event?.target || document.querySelector('button[onclick="updateDashboard()"]');
    const originalText = button ? button.textContent : 'Atualizar Dados';
    if (button) {
        button.textContent = 'Atualizando...';
        button.disabled = true;
    }

    // curtinho: aplicar o filtro já com os dados carregados
    setTimeout(() => {
        applyFiltersAndUpdateCards();

        if (button) {
            button.textContent = originalText;
            button.disabled = false;
        }
        showNotification('Atualizado com sucesso!', 'success');
    }, 300);
}

function showNotification(message, type) {
    const notification = document.createElement('div');
    notification.className = `fixed top-4 right-4 p-4 rounded-lg shadow-lg z-50 ${type === 'success' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'}`;
    notification.textContent = message;

    document.body.appendChild(notification);

    setTimeout(() => {
        notification.remove();
    }, 3000);
}

function animateCounters() {
    const counters = [
        { element: document.getElementById('totalCases'), target: 685.2, suffix: 'M' },
        { element: document.getElementById('totalDeaths'), target: 6.8, suffix: 'M' },
        { element: document.getElementById('totalRecovered'), target: 658.1, suffix: 'M' },
        { element: document.getElementById('activeCases'), target: 20.3, suffix: 'M' }
    ];

    counters.forEach(counter => {
        let current = 0;
        const increment = counter.target / 100;
        const timer = setInterval(() => {
            current += increment;
            if (current >= counter.target) {
                current = counter.target;
                clearInterval(timer);
            }
            counter.element.textContent = current.toFixed(1) + counter.suffix;
        }, 20);
    });
}

function handleLogin(event) {
    event.preventDefault();

    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;

    if (email && password) {
        const submitBtn = event.target.querySelector('button[type="submit"]');
        const originalText = submitBtn.textContent;
        submitBtn.textContent = 'Entrando...';
        submitBtn.disabled = true;

        setTimeout(() => {
            window.location.href = '/dashboard';
        }, 1500);
    }
}

function logout() {
    if (confirm('Tem certeza que deseja sair?')) {
        window.location.href = '/';
    }
}

function togglePasswordVisibility() {
    const passwordInput = document.getElementById('password');
    const eyeIcon = document.getElementById('eyeIcon');

    if (passwordInput.type === 'password') {
        passwordInput.type = 'text';
        eyeIcon.innerHTML = `
            <path d="M3.707 2.293a1 1 0 00-1.414 1.414l14 14a1 1 0 001.414-1.414l-1.473-1.473A10.014 10.014 0 0019.542 10C18.268 5.943 14.478 3 10 3a9.958 9.958 0 00-4.512 1.074l-1.78-1.781zm4.261 4.26l1.514 1.515a2.003 2.003 0 012.45 2.45l1.514 1.514a4 4 0 00-5.478-5.478z"/>
            <path d="M12.454 16.697L9.75 13.992a4 4 0 01-3.742-3.741L2.335 6.578A9.98 9.98 0 00.458 10c1.274 4.057 5.065 7 9.542 7 .847 0 1.669-.105 2.454-.303z"/>
        `;
    } else {
        passwordInput.type = 'password';
        eyeIcon.innerHTML = `
            <path d="M10 12a2 2 0 100-4 2 2 0 000 4z"/>
            <path fill-rule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clip-rule="evenodd"/>
        `;
    }
}

function alternarTema() {
    const body = document.body;
    const themeIcon = document.querySelector('.theme-icon');
    const themeText = document.querySelector('.theme-text');
    const themeIconLogin = document.querySelector('.theme-icon-login');

    body.classList.toggle('dark-theme');

    if (body.classList.contains('dark-theme')) {
        if (themeIcon) themeIcon.textContent = '☀️';
        if (themeText) themeText.textContent = 'Claro';
        if (themeIconLogin) themeIconLogin.textContent = '☀️';
        localStorage.setItem('tema', 'dark');
    } else {
        if (themeIcon) themeIcon.textContent = '🌙';
        if (themeText) themeText.textContent = 'Escuro';
        if (themeIconLogin) themeIconLogin.textContent = '🌙';
        localStorage.setItem('tema', 'light');
    }

    // Destroi apenas os gráficos especificados antes de recriá-los
    destroySelectedCharts();

    // Recarrega o gráfico "Distribuição por Estado" com a métrica atual
    if (globalEstadosData.length > 0) {
        const weeklyMetricSelect = document.getElementById('weeklyMetric');
        const currentMetric = weeklyMetricSelect ? weeklyMetricSelect.value : 'cases';
        distribuicaoporestado(globalEstadosData, currentMetric);
    }

    // Recarrega o gráfico "countriesChart" com a métrica atual
    if (globalCountriesData.length > 0) {
        const chartMetricSelect = document.getElementById('chartMetric');
        const currentMetric = chartMetricSelect ? chartMetricSelect.value : 'cases';
        initCountriesChart();
    }

    // Recarrega o gráfico "timelineChart" com o filtro de estado atual
    if (globalHistoricoData.length > 0) {
        const stateFilter = document.getElementById('stateFilter');
        const currentState = stateFilter ? stateFilter.value : '';
        initTimelineChart(globalHistoricoData.filter(item => !currentState || item.uf === currentState));
    }
}

// Nova função para destruir apenas os gráficos especificados
function destroySelectedCharts() {
    try {
        [timelineChart, countriesChart, weeklyTrendChart].forEach(chart => {
            if (chart && typeof chart.destroy === 'function') {
                try { chart.destroy(); } catch (e) { console.warn('Erro ao destruir chart:', e); }
            }
        });
    } catch (e) {
        console.warn('destroySelectedCharts error', e);
    } finally {
        timelineChart = countriesChart = weeklyTrendChart = null;
    }
}

function loadSavedTheme() {
    const savedTheme = localStorage.getItem('tema');
    const body = document.body;
    const themeIcon = document.querySelector('.theme-icon');
    const themeText = document.querySelector('.theme-text');
    const themeIconLogin = document.querySelector('.theme-icon-login');

    if (savedTheme === 'dark') {
        body.classList.add('dark-theme');
        if (themeIcon) themeIcon.textContent = '☀️';
        if (themeText) themeText.textContent = 'Claro';
        if (themeIconLogin) themeIconLogin.textContent = '☀️';
    } else {
        body.classList.remove('dark-theme');
        if (themeIcon) themeIcon.textContent = '🌙';
        if (themeText) themeText.textContent = 'Escuro';
        if (themeIconLogin) themeIconLogin.textContent = '🌙';
    }
}

// Variáveis do chat
let chatOpen = false;

// Respostas do chatbot
const chatResponses = {
    'qual país tem mais casos': 'Baseado nos dados atuais, os Estados Unidos lideram com 103.4 milhões de casos confirmados, seguidos pela China com 99.3 milhões e Índia com 44.7 milhões.',
    'como está a tendência no brasil': 'O Brasil registra 37.1 milhões de casos totais com 700 mil mortes. A tendência atual mostra estabilização com leve declínio nos novos casos diários.',
    'taxa de mortalidade global': 'A taxa de mortalidade global atual é de aproximadamente 0.99% (6.8 milhões de mortes em 685.2 milhões de casos). Varia significativamente entre países.',
    'casos ativos': 'Atualmente temos 20.3 milhões de casos ativos globalmente, representando cerca de 3% do total de casos confirmados.',
    'recuperados': 'O número global de recuperados é de 658.1 milhões, representando uma taxa de recuperação de aproximadamente 96%.',
    'vacinação': 'Os dados de vacinação não estão disponíveis neste dashboard no momento, mas posso ajudar com informações sobre casos, mortes e recuperações.',
    'europa': 'A Europa registra 245.8 milhões de casos (36% do total mundial). França, Alemanha e Itália estão entre os países mais afetados.',
    'ásia': 'A Ásia tem 198.5 milhões de casos (29% do total mundial). China, Índia, Japão e Coreia do Sul são os países com mais casos na região.',
    'américa': 'As Américas registram 185.2 milhões de casos (27% do total mundial). EUA e Brasil são os países mais afetados da região.',
    'default': 'Posso ajudar com informações sobre casos de COVID-19, estatísticas por país, tendências e dados globais. Tente perguntar sobre países específicos, taxas de mortalidade ou recuperação!'
};

// Função para alternar chat
function toggleChat() {
    const chatWidget = document.getElementById('chatWidget');
    const chatButton = document.getElementById('chatButton');

    chatOpen = !chatOpen;

    if (chatOpen) {
        chatWidget.classList.remove('scale-0');
        chatWidget.classList.add('scale-100');
        chatButton.style.transform = 'scale(0.9)';

        // Focar no input quando abrir
        setTimeout(() => {
            document.getElementById('chatInput').focus();
        }, 300);
    } else {
        chatWidget.classList.remove('scale-100');
        chatWidget.classList.add('scale-0');
        chatButton.style.transform = 'scale(1)';
    }
}

// Função para enviar mensagem

async function sendMessage() {
    const input = document.getElementById('chatInput');
    const message = input.value.trim();
    if (message) {
        addUserMessage(message);
        input.value = '';

        // Aguarda a resposta do agente
        const botResponse = await getBotResponse(message);
        addBotMessage(botResponse);
    }
}


// Função para lidar com Enter no chat
function handleChatKeyPress(event) {
    if (event.key === 'Enter') {
        sendMessage();
    }
}

// Função para perguntas sugeridas
function askQuestion(question) {
    document.getElementById('chatInput').value = question;
    sendMessage();
}

// Adicionar mensagem do usuário
function addUserMessage(message) {
    const chatMessages = document.getElementById('chatMessages');
    const messageDiv = document.createElement('div');
    messageDiv.className = 'flex items-start space-x-2 mb-4 justify-end';
    messageDiv.innerHTML = `
        <div class="bg-blue-600 text-white rounded-lg p-3 shadow-sm max-w-xs">
            <p class="text-sm">${message}</p>
        </div>
        <div class="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center flex-shrink-0">
            <svg class="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clip-rule="evenodd"/>
            </svg>
        </div>
    `;
    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Adicionar mensagem do bot
function addBotMessage(message) {
    const chatMessages = document.getElementById('chatMessages');
    const messageDiv = document.createElement('div');
    messageDiv.className = 'flex items-start space-x-2 mb-4';
    messageDiv.innerHTML = `
        <div class="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
            <svg class="w-4 h-4 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                <path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z"/>
            </svg>
        </div>
        <div class="bg-white rounded-lg p-3 shadow-sm max-w-xs typing-animation">
            <p class="text-sm text-gray-800">${message}</p>
        </div>
    `;
    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Obter resposta do bot

async function getBotResponse(message) {
    try {
        const res = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message })
        });
        const data = await res.json();
        return data.response || 'Desculpe, não consegui entender.';
    } catch (error) {
        return 'Erro ao conectar com o agente.';
    }
}
// expor no escopo global
window.alternarTema = alternarTema;
window.logout = logout;
window.updateDashboard = updateDashboard;
window.toggleDataset = toggleDataset;
window.updateCountriesChart = updateCountriesChart;
window.updateWeeklyTrendChart = updateWeeklyTrendChart;
window.renderBrazilMap = renderBrazilMap;
window.toggleChat = toggleChat;
window.sendMessage = sendMessage;
window.askQuestion = askQuestion;
window.closeMunicipiosModal = closeMunicipiosModal;
window.handleLogin = handleLogin;
window.togglePasswordVisibility = togglePasswordVisibility;
