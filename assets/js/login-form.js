/**
 * Bezpečný login formulář s frontend hashováním hesel
 */

import { sha1Hash } from './utils/crypto.js';
import { createDebugLogger } from './utils/debug.js';

const logger = createDebugLogger('LoginForm');

/**
 * Inicializace bezpečného login formuláře
 */
function initSecureLoginForm() {
    const forms = document.querySelectorAll('form[action*="login"]');
    
    if (forms.length === 0) {
        logger.lifecycle('Žádný login formulář nenalezen');
        return;
    }

    forms.forEach(form => {
        logger.lifecycle('Inicializace bezpečného login formuláře');
        
        form.addEventListener('submit', async (event) => {
            event.preventDefault(); // Zabráníme standardnímu odeslání
            
            const formData = new FormData(form);
            const email = formData.get('username');
            const password = formData.get('password');
            
            if (!email || !password) {
                showError('Vyplňte prosím email a heslo');
                return;
            }
            
            try {
                logger.api('POST', 'login', { email, password: '[HIDDEN]' });
                
                // 🔒 BEZPEČNOST: Hashuj heslo před odesláním
                const hashedPassword = await sha1Hash(password);
                logger.custom('Password hashed', { 
                    originalLength: password.length,
                    hashLength: hashedPassword.length 
                });
                
                // Odeslat zahashované heslo
                await performLogin(form, email, hashedPassword);
                
            } catch (error) {
                logger.error('Login failed', error);
                showError('Chyba při přihlašování: ' + error.message);
            }
        });
    });
}

/**
 * Provede přihlášení se zahashovaným heslem
 */
async function performLogin(form, email, hashedPassword) {
    const submitButton = form.querySelector('button[type="submit"]');
    const originalText = submitButton.textContent;

    // Získat redirect URL z hidden inputu (pokud existuje)
    const redirectInput = form.querySelector('input[name="redirect_url"]');
    const redirectUrl = redirectInput ? redirectInput.value : null;

    try {
        // UI feedback
        submitButton.disabled = true;
        submitButton.textContent = 'Přihlašuji...';

        const requestBody = {
            username: email,
            password: hashedPassword // 🔒 Odesíláme hash, ne plain text
        };

        // Přidat redirect URL do požadavku, pokud existuje
        if (redirectUrl) {
            requestBody.redirect_url = redirectUrl;
            logger.custom('Redirect URL included', { redirectUrl });
        }

        const response = await fetch(form.action, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Requested-With': 'XMLHttpRequest'
            },
            body: JSON.stringify(requestBody)
        });

        const result = await response.json();
        logger.api('POST', form.action, null, result);

        if (result.success) {
            logger.lifecycle('Login successful, redirecting...');

            // Použít redirect URL z odpovědi, pokud existuje
            const targetUrl = result.redirect_url || redirectUrl || '/';
            logger.custom('Redirecting to', { targetUrl });

            // Úspěšné přihlášení - přesměruj
            window.location.href = targetUrl;
        } else {
            throw new Error(result.message || 'Přihlášení se nezdařilo');
        }

    } catch (error) {
        logger.error('Network error during login', error);
        throw error;
    } finally {
        // Restore UI
        submitButton.disabled = false;
        submitButton.textContent = originalText;
    }
}

/**
 * Zobrazí chybovou zprávu
 */
function showError(message) {
    // Najdi nebo vytvoř error container
    let errorContainer = document.querySelector('.login-error');
    
    if (!errorContainer) {
        const form = document.querySelector('form[action*="login"]');
        errorContainer = document.createElement('div');
        errorContainer.className = 'alert alert--error login-error';
        form.parentNode.insertBefore(errorContainer, form);
    }
    
    // Zprávu vkládat jako text, ne HTML
    const content = document.createElement('div');
    content.className = 'alert__content';
    const label = document.createElement('strong');
    label.textContent = 'Chyba přihlášení:';
    content.append(label, ' ' + message);
    errorContainer.replaceChildren(content);
    
    errorContainer.style.display = 'block';
    
    // Skryj po 10 sekundách
    setTimeout(() => {
        errorContainer.style.display = 'none';
    }, 10000);
}

/**
 * Inicializace toggle pro zobrazení/skrytí hesla
 */
function initPasswordToggle() {
    const toggleButtons = document.querySelectorAll('[data-toggle-password]');

    if (toggleButtons.length === 0) {
        return;
    }

    toggleButtons.forEach(button => {
        const targetId = button.getAttribute('data-toggle-password');
        const input = document.getElementById(targetId);

        if (!input) {
            logger.error('Password input not found', { targetId });
            return;
        }

        logger.lifecycle('Inicializace password toggle', { targetId });

        button.addEventListener('click', () => {
            const isPassword = input.type === 'password';

            // Toggle typu inputu
            input.type = isPassword ? 'text' : 'password';

            // Toggle třídy na tlačítku
            button.classList.toggle('is-visible', isPassword);

            // Změna ikony - eye ↔ eye-off
            const svg = button.querySelector('svg');
            if (svg) {
                const useElement = svg.querySelector('use');
                if (useElement) {
                    const currentHref = useElement.getAttribute('href');
                    const newHref = isPassword
                        ? currentHref.replace('#tabler-eye', '#tabler-eye-off')
                        : currentHref.replace('#tabler-eye-off', '#tabler-eye');
                    useElement.setAttribute('href', newHref);
                }
            }

            // Aktualizace aria-label
            button.setAttribute('aria-label', isPassword ? 'Skrýt heslo' : 'Zobrazit heslo');

            logger.state('password visibility', !isPassword, isPassword);
        });
    });
}

// Inicializuj při načtení DOM
document.addEventListener('DOMContentLoaded', () => {
    initSecureLoginForm();
    initPasswordToggle();
});