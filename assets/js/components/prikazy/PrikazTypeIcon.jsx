import React from 'react';
import {
    IconHammer,
    IconBrush,
    IconTool,
    IconSignLeft,
} from '@tabler/icons-react';

const druhZPIkona = {
    O: IconBrush,      // Obnova – štětec
    N: IconTool,       // Nová – nářadí
    S: IconSignLeft,   // Směrovky/rozcestníky – směrovka
};

export function PrikazTypeIcon({ type, size = 28 }) {
    const IconComponent = druhZPIkona[type] || IconHammer; // Default: kladivo

    return (
        <div 
            className="flex items-center justify-center border-2 border-gray-300 bg-white rounded"
            style={{
                width: `${size}px`,
                height: `${size}px`,
            }}
        >
            <IconComponent 
                style={{ 
                    width: '80%', 
                    height: '80%',
                    color: '#6b7280' // gray-500
                }} 
            />
        </div>
    );
}