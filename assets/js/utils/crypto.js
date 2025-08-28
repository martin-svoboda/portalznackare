/**
 * Crypto utilities pro bezpečné hashování hesel
 */

/**
 * Vytvoří SHA1 hash ze stringu - kompatibilní s MSSQL HASHBYTES('SHA1', @password)
 * @param {string} text - Text k zahashování
 * @returns {Promise<string>} - SHA1 hash ve formátu UPPER CASE HEX
 */
export async function sha1Hash(text) {
    const encoder = new TextEncoder();
    const data = encoder.encode(text);
    const hashBuffer = await crypto.subtle.digest('SHA-1', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray
        .map(byte => byte.toString(16).padStart(2, '0'))
        .join('')
        .toUpperCase();
    
    return hashHex;
}

/**
 * Bezpečně hashuje heslo před odesláním na server
 * @param {string} password - Plain text heslo
 * @returns {Promise<string>} - Zahashované heslo
 */
export async function hashPassword(password) {
    if (!password || password.trim() === '') {
        throw new Error('Heslo nesmí být prázdné');
    }
    
    try {
        return await sha1Hash(password);
    } catch (error) {
        console.error('Chyba při hashování hesla:', error);
        throw new Error('Chyba při zpracování hesla');
    }
}