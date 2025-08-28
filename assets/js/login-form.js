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
    
    try {
        // UI feedback
        submitButton.disabled = true;
        submitButton.textContent = 'Přihlašuji...';
        
        const response = await fetch(form.action, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Requested-With': 'XMLHttpRequest'
            },
            body: JSON.stringify({
                username: email,
                password: hashedPassword // 🔒 Odesíláme hash, ne plain text
            })
        });
        
        const result = await response.json();
        logger.api('POST', form.action, null, result);
        
        if (result.success) {
            logger.lifecycle('Login successful, redirecting...');
            // Úspěšné přihlášení - přesměruj
            window.location.href = '/';
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
    
    errorContainer.innerHTML = `
        <div class="alert__content">
            <strong>Chyba přihlášení:</strong> ${message}
        </div>
    `;
    
    errorContainer.style.display = 'block';
    
    // Skryj po 10 sekundách
    setTimeout(() => {
        errorContainer.style.display = 'none';
    }, 10000);
}

// Inicializuj při načtení DOM
document.addEventListener('DOMContentLoaded', initSecureLoginForm);