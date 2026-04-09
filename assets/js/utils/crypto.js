/**
 * Crypto utilities pro bezpečné hashování hesel
 */

/**
 * Vytvoří SHA1 hash ze stringu - kompatibilní s MSSQL HASHBYTES('SHA1', @password)
 * Pokud crypto.subtle není dostupné (starší prohlížeče, in-app browsery),
 * vrátí null a server provede hashování sám.
 * @param {string} text - Text k zahashování
 * @returns {Promise<string|null>} - SHA1 hash ve formátu UPPER CASE HEX, nebo null
 */
export async function sha1Hash(text) {
    if (typeof crypto === 'undefined' || !crypto.subtle) {
        return null;
    }

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
 * Hashuje heslo před odesláním na server.
 * Pokud frontend hashování není dostupné, vrátí plain text heslo —
 * server detekuje formát a zahashuje ho sám (přenos je chráněn HTTPS).
 * @param {string} password - Plain text heslo
 * @returns {Promise<string>} - Zahashované heslo nebo plain text jako fallback
 */
export async function hashPassword(password) {
    if (!password || password.trim() === '') {
        throw new Error('Heslo nesmí být prázdné');
    }

    const hash = await sha1Hash(password);
    return hash || password;
}