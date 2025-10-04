function toggleTheme() {
    const body = document.body;
    const themeIcon = document.querySelector('.theme-icon-login');

    body.classList.toggle('dark-theme');

    if (body.classList.contains('dark-theme')) {
        if (themeIcon) themeIcon.textContent = '☀️';
        localStorage.setItem('tema', 'dark');
    } else {
        if (themeIcon) themeIcon.textContent = '🌙';
        localStorage.setItem('tema', 'light');
    }
}

function loadSavedTheme() {
    const savedTheme = localStorage.getItem('tema');
    const body = document.body;
    const themeIcon = document.querySelector('.theme-icon-login');

    if (savedTheme === 'dark') {
        body.classList.add('dark-theme');
        if (themeIcon) themeIcon.textContent = '☀️';
    } else {
        body.classList.remove('dark-theme');
        if (themeIcon) themeIcon.textContent = '🌙';
    }
}

// Inicializar tema ao carregar a página
document.addEventListener('DOMContentLoaded', loadSavedTheme);

// Adicionar evento ao botão de tema
document.querySelector('.theme-toggle')?.addEventListener('click', toggleTheme);

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