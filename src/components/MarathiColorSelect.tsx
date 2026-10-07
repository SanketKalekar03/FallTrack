import React, { useState, useEffect, useRef } from 'react';
import { Search, Plus, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useColorStore } from '../store/useColorStore';
import type { Color } from '../types';
import { matchColor, isExactColorMatch } from '../utils/transliterate';
import { deduplicateColors } from '../services/dbService';

interface MarathiColorSelectProps {
  selectedColorId: string;
  onSelect: (colorId: string) => void;
  error?: string;
  placeholder?: string;
}

export const MarathiColorSelect: React.FC<MarathiColorSelectProps> = ({
  selectedColorId,
  onSelect,
  error,
  placeholder = "Select Color"
}) => {
  const { colors, addColor, fetchColors } = useColorStore();
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeItemIndex, setActiveItemIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchColors();
  }, [fetchColors]);

  // Set initial search value to the selected color name
  useEffect(() => {
    if (selectedColorId) {
      const selectedColor = colors.find(c => c.id === selectedColorId);
      if (selectedColor) {
        setSearchQuery(selectedColor.name);
      }
    } else {
      setSearchQuery('');
    }
  }, [selectedColorId, colors]);

  // Handle click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        // Reset search query to selected color if they click away without choosing
        const selectedColor = colors.find(c => c.id === selectedColorId);
        setSearchQuery(selectedColor ? selectedColor.name : '');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [selectedColorId, colors]);

  // Filter colors
  const filteredColors = deduplicateColors(
    colors.filter(color => matchColor(color.name, searchQuery))
  );

  const exactMatch = colors.some(
    color => isExactColorMatch(color.name, searchQuery)
  );

  const handleSelectColor = (color: Color) => {
    onSelect(color.id);
    setSearchQuery(color.name);
    setIsOpen(false);
    setActiveItemIndex(-1);
  };

  const handleCreateNewColor = async () => {
    const name = searchQuery.trim();
    if (!name) return;
    try {
      const newColor = await addColor(name);
      handleSelectColor(newColor);
    } catch (err) {
      console.error("Failed to create color:", err);
    }
  };

  // Keyboard Navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'Enter') {
        setIsOpen(true);
      }
      return;
    }

    const maxItems = filteredColors.length + (!exactMatch && searchQuery.trim().length > 0 ? 1 : 0);

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setActiveItemIndex(prev => (prev + 1) % maxItems);
        break;
      case 'ArrowUp':
        e.preventDefault();
        setActiveItemIndex(prev => (prev - 1 + maxItems) % maxItems);
        break;
      case 'Enter':
        e.preventDefault();
        if (activeItemIndex >= 0 && activeItemIndex < filteredColors.length) {
          handleSelectColor(filteredColors[activeItemIndex]);
        } else if (activeItemIndex === filteredColors.length && !exactMatch) {
          handleCreateNewColor();
        } else if (searchQuery.trim()) {
          // If query typed and enter pressed but no item highlighted, check match or create
          const matched = colors.find(c => c.name.toLowerCase() === searchQuery.trim().toLowerCase());
          if (matched) {
            handleSelectColor(matched);
          } else {
            handleCreateNewColor();
          }
        }
        break;
      case 'Escape':
        setIsOpen(false);
        inputRef.current?.blur();
        break;
      case 'Tab':
        setIsOpen(false);
        break;
    }
  };

  return (
    <div ref={containerRef} className="relative w-full z-10">
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            setIsOpen(true);
            setActiveItemIndex(-1);
            if (!e.target.value) {
              onSelect(''); // Clear selection if input is cleared
            }
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className={`w-full px-3 py-2 pl-9 text-xs bg-white border rounded-lg outline-none shadow-sm transition-all duration-200 ${
            error 
              ? 'border-red-300 focus:border-red-500 focus:ring-3 focus:ring-red-500/10' 
              : 'border-slate-200 focus:border-brand-primary focus:ring-3 focus:ring-brand-primary/10'
          }`}
        />
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
          <Search size={14} />
        </div>
      </div>

      {/* Dropdown Options */}
      <AnimatePresence>
        {isOpen && (
          <motion.div 
            initial={{ opacity: 0, y: -6, scaleY: 0.95 }}
            animate={{ opacity: 1, y: 0, scaleY: 1 }}
            exit={{ opacity: 0, y: -6, scaleY: 0.95 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            style={{ originY: 0 }}
            className="absolute z-30 w-full mt-1.5 bg-white border border-slate-150 rounded-lg shadow-soft max-h-48 overflow-y-auto"
          >
            {filteredColors.length === 0 && searchQuery.trim().length === 0 ? (
              <div className="px-3 py-2 text-xs text-slate-400 text-center">
                Type to search colors...
              </div>
            ) : null}

            {filteredColors.map((color, index) => {
              const isSelected = selectedColorId === color.id;
              const isHighlighted = activeItemIndex === index;
              return (
                <button
                  key={color.id}
                  type="button"
                  onClick={() => handleSelectColor(color)}
                  className={`w-full text-left px-3 py-2 text-xs flex items-center justify-between transition-colors cursor-pointer ${
                    isHighlighted ? 'bg-brand-light-purple text-brand-primary font-semibold' : 'hover:bg-slate-50 text-slate-700'
                  }`}
                >
                  <span>{color.name}</span>
                  {isSelected && <Check size={13} className="text-brand-primary" />}
                </button>
              );
            })}

            {/* Add New Color Option */}
            {searchQuery.trim().length > 0 && !exactMatch && (
              <button
                type="button"
                onClick={handleCreateNewColor}
                className={`w-full text-left px-3 py-2 text-xs font-bold border-t border-slate-50 text-brand-primary flex items-center gap-1.5 transition-colors cursor-pointer ${
                  activeItemIndex === filteredColors.length ? 'bg-brand-light-purple' : 'hover:bg-brand-light-purple/40'
                }`}
              >
                <Plus size={13} />
                <span>Add new color: "{searchQuery.trim()}"</span>
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {error && (
        <span className="text-[10px] text-red-500 font-medium mt-1 block">
          {error}
        </span>
      )}
    </div>
  );
};
export default MarathiColorSelect;
