import React from 'react';

/**
 * Globální utilita pro jednotné zobrazení state badges napříč aplikacemi
 */

const STATE_LABELS = {
    'draft': 'Rozpracováno',
    'send': 'Odesílání do INSYZ',
    'submitted': 'Přijato v INSYZ',
    'approved': 'Schváleno v INSYZ',
    'rejected': 'Zamítnuto v INSYZ',
};

const STATE_BADGE_CLASSES = {
    'draft': 'badge--secondary',
    'send': 'badge--warning',
    'submitted': 'badge--primary',
    'approved': 'badge--success',
    'rejected': 'badge--danger',
};

export const getStateLabel = (state) => STATE_LABELS[state] || state;

export const StateBadge = ({ state, className = '' }) => (
    <span className={`badge badge--light ${STATE_BADGE_CLASSES[state] || STATE_BADGE_CLASSES.draft} ${className}`}>
        {getStateLabel(state)}
    </span>
);