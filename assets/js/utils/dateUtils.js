/**
 * Global date utilities
 * Can be used by any React application
 */

/**
 * Format date for Czech locale
 */
export const formatDateCZ = (date, options = {}) => {
    if (!date) return '';
    
    const d = date instanceof Date ? date : new Date(date);
    if (isNaN(d.getTime())) return '';
    
    const defaultOptions = {
        day: 'numeric',
        month: 'numeric',
        year: 'numeric',
        ...options
    };
    
    return d.toLocaleDateString('cs-CZ', defaultOptions);
};

/**
 * Format time for Czech locale
 */
export const formatTimeCZ = (date, options = {}) => {
    if (!date) return '';
    
    const d = date instanceof Date ? date : new Date(date);
    if (isNaN(d.getTime())) return '';
    
    const defaultOptions = {
        hour: '2-digit',
        minute: '2-digit',
        ...options
    };
    
    return d.toLocaleTimeString('cs-CZ', defaultOptions);
};

/**
 * Format datetime for Czech locale
 */
export const formatDateTimeCZ = (date, options = {}) => {
    if (!date) return '';
    
    const d = date instanceof Date ? date : new Date(date);
    if (isNaN(d.getTime())) return '';
    
    const defaultOptions = {
        day: 'numeric',
        month: 'numeric', 
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        ...options
    };
    
    return d.toLocaleString('cs-CZ', defaultOptions);
};

/**
 * Get start of day
 */
export const startOfDay = (date) => {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d;
};

/**
 * Get end of day
 */
export const endOfDay = (date) => {
    const d = new Date(date);
    d.setHours(23, 59, 59, 999);
    return d;
};

/**
 * Add days to date
 */
export const addDays = (date, days) => {
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    return d;
};

/**
 * Subtract days from date
 */
export const subtractDays = (date, days) => {
    return addDays(date, -days);
};

/**
 * Get difference in days between two dates
 */
export const daysDifference = (date1, date2) => {
    const d1 = startOfDay(date1);
    const d2 = startOfDay(date2);
    const diffTime = Math.abs(d2 - d1);
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};

/**
 * Check if date is today
 */
export const isToday = (date) => {
    const today = new Date();
    const d = new Date(date);
    
    return d.getDate() === today.getDate() &&
           d.getMonth() === today.getMonth() &&
           d.getFullYear() === today.getFullYear();
};

/**
 * Check if date is in the past
 */
export const isPast = (date) => {
    return new Date(date) < new Date();
};

/**
 * Check if date is in the future
 */
export const isFuture = (date) => {
    return new Date(date) > new Date();
};

/**
 * Get first day of month
 */
export const firstDayOfMonth = (date) => {
    const d = new Date(date);
    return new Date(d.getFullYear(), d.getMonth(), 1);
};

/**
 * Get last day of month
 */
export const lastDayOfMonth = (date) => {
    const d = new Date(date);
    return new Date(d.getFullYear(), d.getMonth() + 1, 0);
};

/**
 * Get age from birth date
 */
export const getAge = (birthDate) => {
    const today = new Date();
    const birth = new Date(birthDate);
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
        age--;
    }
    
    return age;
};

/**
 * Parse Czech date format (DD.MM.YYYY)
 */
export const parseCzechDate = (dateString) => {
    if (!dateString) return null;
    
    const parts = dateString.split('.');
    if (parts.length !== 3) return null;
    
    const day = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1; // Months are 0-indexed
    const year = parseInt(parts[2], 10);
    
    const date = new Date(year, month, day);
    
    // Validate the date
    if (date.getDate() !== day || date.getMonth() !== month || date.getFullYear() !== year) {
        return null;
    }
    
    return date;
};

/**
 * Format date to Czech format (DD.MM.YYYY)
 */
export const toCzechDateFormat = (date) => {
    if (!date) return '';
    
    const d = date instanceof Date ? date : new Date(date);
    if (isNaN(d.getTime())) return '';
    
    const day = d.getDate().toString().padStart(2, '0');
    const month = (d.getMonth() + 1).toString().padStart(2, '0');
    const year = d.getFullYear();
    
    return `${day}.${month}.${year}`;
};

/**
 * Get relative time string (Czech)
 */
export const getRelativeTime = (date) => {
    const now = new Date();
    const d = new Date(date);
    const diffMs = now - d;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    
    if (diffMinutes < 1) return 'právě teď';
    if (diffMinutes < 60) return `před ${diffMinutes} min`;
    if (diffHours < 24) return `před ${diffHours} h`;
    if (diffDays === 1) return 'včera';
    if (diffDays < 7) return `před ${diffDays} dny`;
    if (diffDays < 30) return `před ${Math.floor(diffDays / 7)} týdny`;
    if (diffDays < 365) return `před ${Math.floor(diffDays / 30)} měsíci`;
    
    return `před ${Math.floor(diffDays / 365)} lety`;
};

/**
 * Get week day name in Czech
 */
export const getWeekDayName = (date, short = false) => {
    const d = new Date(date);
    const options = { weekday: short ? 'short' : 'long' };
    return d.toLocaleDateString('cs-CZ', options);
};

/**
 * Get month name in Czech
 */
export const getMonthName = (date, short = false) => {
    const d = new Date(date);
    const options = { month: short ? 'short' : 'long' };
    return d.toLocaleDateString('cs-CZ', options);
};

/**
 * Check if two dates are on the same day
 */
export const isSameDay = (date1, date2) => {
    const d1 = new Date(date1);
    const d2 = new Date(date2);
    
    return d1.getDate() === d2.getDate() &&
           d1.getMonth() === d2.getMonth() &&
           d1.getFullYear() === d2.getFullYear();
};

/**
 * Get ISO date string (YYYY-MM-DD) - useful for API calls
 */
export const toISODateString = (date) => {
    if (!date) return '';
    
    const d = date instanceof Date ? date : new Date(date);
    if (isNaN(d.getTime())) return '';
    
    return d.toISOString().split('T')[0];
};

/**
 * Working days utilities
 */
export const isWeekend = (date) => {
    const day = new Date(date).getDay();
    return day === 0 || day === 6; // Sunday or Saturday
};

export const isWorkingDay = (date) => {
    return !isWeekend(date);
};

export const addWorkingDays = (date, days) => {
    let currentDate = new Date(date);
    let addedDays = 0;
    
    while (addedDays < days) {
        currentDate = addDays(currentDate, 1);
        if (isWorkingDay(currentDate)) {
            addedDays++;
        }
    }
    
    return currentDate;
};