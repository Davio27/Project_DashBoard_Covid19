// Função de alternar tema
function alternarTema() {
    const body = document.body;
    const themeIcon = document.querySelector('.theme-icon');

    body.classList.toggle('dark-theme');

    if (body.classList.contains('dark-theme')) {
        if (themeIcon) themeIcon.textContent = '☀️'; // sol no dark
        localStorage.setItem('tema', 'dark');
    } else {
        if (themeIcon) themeIcon.textContent = '🌙'; // lua no light
        localStorage.setItem('tema', 'light');
    }
}

// Carregar tema salvo ao iniciar
function loadSavedTheme() {
    const savedTheme = localStorage.getItem('tema');
    const body = document.body;
    const themeIcon = document.querySelector('.theme-icon');

    if (savedTheme === 'dark') {
        body.classList.add('dark-theme');
        if (themeIcon) themeIcon.textContent = '☀️';
    } else {
        body.classList.remove('dark-theme');
        if (themeIcon) themeIcon.textContent = '🌙';
    }
}

// Função para corrigir labels flutuantes
function fixFloatingLabels() {
    const inputs = document.querySelectorAll('.input-group input');

    inputs.forEach(input => {
        const checkValue = () => {
            if (input.value) {
                input.classList.add('has-value');
            } else {
                input.classList.remove('has-value');
            }
        };

        // Checa imediatamente
        checkValue();

        // Checa novamente depois de um pequeno delay (para autofill)
        setTimeout(checkValue, 100);

        // Atualiza ao digitar ou alterar
        input.addEventListener('input', checkValue);
        input.addEventListener('change', checkValue);
    });
}

// Inicializa ao carregar a página
document.addEventListener('DOMContentLoaded', () => {
    loadSavedTheme();
    // Corrigir labels flutuantes
    fixFloatingLabels();

    // Adicionar evento ao botão
    const themeBtn = document.querySelector('.theme-toggle');
    if (themeBtn) themeBtn.addEventListener('click', alternarTema);

    // Configurar toggle da senha
    const passwordInput = document.getElementById('password');
    const toggleBtn = document.getElementById('togglePasswordBtn');
    const eyeImg = document.getElementById('eyeImg');

    const closedEyeSrc = "https://img.icons8.com/ios/50/closed-eye.png";
    const invisibleSrc = "https://img.icons8.com/ios/50/invisible.png";

    function togglePassword() {
        if (passwordInput.type === 'password') {
            passwordInput.type = 'text';
            eyeImg.src = closedEyeSrc;
        } else {
            passwordInput.type = 'password';
            eyeImg.src = invisibleSrc;
        }
    }

    if (toggleBtn) toggleBtn.addEventListener('click', togglePassword);

    // Função de "piscar" inicial
    function blinkEyes(duration = 3000, interval = 400) {
        let elapsed = 0;
        const blinkInterval = setInterval(() => {
            eyeImg.src = eyeImg.src === invisibleSrc ? closedEyeSrc : invisibleSrc;
            elapsed += interval;
            if (elapsed >= duration) {
                clearInterval(blinkInterval);
                eyeImg.src = invisibleSrc; // volta para o estado inicial
            }
        }, interval);
    }

    blinkEyes();
});
