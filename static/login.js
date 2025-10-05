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

document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.input-group input').forEach(input => {
        // Se já tiver valor (preenchimento automático), move o label para cima
        if (input.value) {
            input.classList.add('has-value');
        }

        // Atualiza ao digitar
        input.addEventListener('input', () => {
            if (input.value) {
                input.classList.add('has-value');
            } else {
                input.classList.remove('has-value');
            }
        });
    });
});

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

// Função para alternar visibilidade da senha
function togglePasswordVisibility() {
    const passwordInput = document.getElementById('password');
    const eyeIcon = document.getElementById('eyeIcon');

    if (passwordInput.type === 'password') {
        passwordInput.type = 'text';
        eyeIcon.innerHTML = `
            <path d="M10 12a2 2 0 100-4 2 2 0 000 4z"/>
            <path fill-rule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clip-rule="evenodd"/>
        `;
    } else {
        passwordInput.type = 'password';
        eyeIcon.innerHTML = `
            <path d="M10 12a2 2 0 100-4 2 2 0 000 4z"/>
            <path fill-rule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clip-rule="evenodd"/>
        `;
    }
}

// Função de login (exemplo)
function handleLogin(event) {
    event.preventDefault();
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    console.log('Email:', email, 'Senha:', password);
    // Aqui você colocaria sua lógica de autenticação
}

// Alternar tema (exemplo)
function alternarTema() {
    document.body.classList.toggle('dark-theme');
}

// Executa ao carregar a página
document.addEventListener('DOMContentLoaded', () => {
    fixFloatingLabels();
});


document.addEventListener('DOMContentLoaded', () => {

    const passwordInput = document.getElementById('password');
    const toggleBtn = document.getElementById('togglePasswordBtn');
    const eyeImg = document.getElementById('eyeImg');

    const closedEyeSrc = "https://img.icons8.com/ios/50/invisible.png";
    const invisibleSrc = "https://img.icons8.com/ios/50/closed-eye.png";

    // Função para alternar senha visível/invisível
    function togglePassword() {
        if (passwordInput.type === 'password') {
            passwordInput.type = 'text';
            eyeImg.src = closedEyeSrc;
        } else {
            passwordInput.type = 'password';
            eyeImg.src = invisibleSrc;
        }
    }

    toggleBtn.addEventListener('click', togglePassword);

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

    // Inicia o piscar na tela
    blinkEyes();

});