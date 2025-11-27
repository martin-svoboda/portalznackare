import React, { useState, useRef, useEffect } from 'react';
import { IconHighlight } from '@tabler/icons-react';

/**
 * Color Highlight Dropdown
 * Text background color picker
 */
const ColorHighlightDropdown = ({ editor }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  const colors = [
    { color: '#FEF08A', label: 'Žlutá' },
    { color: '#FED7AA', label: 'Oranžová' },
    { color: '#FECACA', label: 'Červená' },
    { color: '#BBF7D0', label: 'Zelená' },
    { color: '#BFDBFE', label: 'Modrá' },
    { color: '#DDD6FE', label: 'Fialová' },
    { color: '#FED7D7', label: 'Růžová' },
    { color: '#E5E7EB', label: 'Šedá' },
  ];

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleColorSelect = (color) => {
    editor.chain().focus().setHighlight({ color }).run();
    setIsOpen(false);
  };

  const handleRemoveHighlight = () => {
    editor.chain().focus().unsetHighlight().run();
    setIsOpen(false);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 transition-colors"
        title="Zvýraznění textu"
      >
        <IconHighlight size={18} />
      </button>

      {isOpen && (
        <div className="absolute top-full right-0 mt-1 z-50 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-sm shadow-lg p-1">
          <div className="grid grid-cols-3 !gap-0 mb-0.5">
            {colors.map((item) => (
              <button
                key={item.color}
                type="button"
                onClick={() => handleColorSelect(item.color)}
                className="w-5 h-5 rounded-sm border border-gray-300 dark:border-gray-600 hover:scale-110 transition-transform"
                style={{ backgroundColor: item.color }}
                title={item.label}
              />
            ))}
          </div>
          <button
            type="button"
            onClick={handleRemoveHighlight}
            className="w-full px-1.5 py-0.5 text-xs rounded-sm hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
          >
            Odstranit
          </button>
        </div>
      )}
    </div>
  );
};

export default ColorHighlightDropdown;
