import React, { useState, useRef, useEffect } from 'react';
import { IconList, IconListNumbers, IconListCheck, IconCheck } from '@tabler/icons-react';

/**
 * List Dropdown Menu
 * Bullet, Ordered, Task lists
 */
const ListDropdownMenu = ({ editor }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  const listTypes = [
    { type: 'bulletList', label: 'Odrážkový seznam', icon: IconList },
    { type: 'orderedList', label: 'Číslovaný seznam', icon: IconListNumbers },
    { type: 'taskList', label: 'Checklist', icon: IconListCheck },
  ];

  // Close dropdown when clicking outside
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

  const handleListSelect = (type) => {
    if (type === 'bulletList') {
      editor.chain().focus().toggleBulletList().run();
    } else if (type === 'orderedList') {
      editor.chain().focus().toggleOrderedList().run();
    } else if (type === 'taskList') {
      editor.chain().focus().toggleTaskList().run();
    }
    setIsOpen(false);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 transition-colors"
        title="Seznamy"
      >
        <IconList size={18} />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-1 z-50 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg p-2 min-w-[200px]">
          {listTypes.map((list) => {
            const Icon = list.icon;
            const isActive = editor?.isActive(list.type);

            return (
              <button
                key={list.type}
                type="button"
                onClick={() => handleListSelect(list.type)}
                className="w-full flex items-center gap-2 px-3 py-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-left text-sm text-gray-700 dark:text-gray-300"
              >
                <Icon size={18} />
                <span className="flex-1">{list.label}</span>
                {isActive && (
                  <IconCheck size={16} className="text-blue-600 dark:text-blue-400" />
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ListDropdownMenu;
