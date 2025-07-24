/**
 * Jednoduchá notifikační utilita
 * Zobrazuje flash zprávy uživateli
 */

export function showNotification(type, message) {
    // Pokud existuje nativní notifikační systém, použij ho
    if (window.flashMessage) {
        window.flashMessage(message, type);
        return;
    }
    
    // Fallback na console
    if (type === 'error') {
        console.error(`Chyba: ${message}`);
    } else if (type === 'success') {
        console.log(`Úspěch: ${message}`);
    } else {
        console.log(`Info: ${message}`);
    }
    
    // TODO: Implementovat vlastní notifikační systém pokud bude potřeba
}