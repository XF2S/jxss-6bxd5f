import React, { useCallback, useEffect, useRef, useState } from 'react';
import { 
  MenuItem, 
  Select, 
  FormControl, 
  InputLabel, 
  FormHelperText,
  SelectChangeEvent 
} from '@mui/material'; // v5.0.0
import { useVirtualizer } from '@tanstack/react-virtual'; // v3.0.0
import { useForm } from '../../hooks/useForm';
import { ProgramType } from '../../types/application.types';
import './theme.css';

/**
 * Enhanced props interface for Dropdown component with validation and accessibility support
 */
interface DropdownProps {
  id: string;
  label: string;
  options: Array<{
    value: string;
    label: string;
    disabled?: boolean;
  }>;
  value: string | string[];
  onChange: (value: string | string[], event: SelectChangeEvent) => void;
  onBlur?: (event: React.FocusEvent) => void;
  multiple?: boolean;
  error?: boolean;
  helperText?: string;
  disabled?: boolean;
  required?: boolean;
  fullWidth?: boolean;
  virtualizeThreshold?: number;
  'aria-label'?: string;
  'aria-describedby'?: string;
}

/**
 * A comprehensive dropdown component implementing Material Design 3 specifications
 * with enhanced accessibility features and form validation integration.
 */
const Dropdown: React.FC<DropdownProps> = ({
  id,
  label,
  options,
  value,
  onChange,
  onBlur,
  multiple = false,
  error = false,
  helperText,
  disabled = false,
  required = false,
  fullWidth = true,
  virtualizeThreshold = 100,
  'aria-label': ariaLabel,
  'aria-describedby': ariaDescribedBy,
}) => {
  // Refs for virtualization and keyboard navigation
  const parentRef = useRef<HTMLDivElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeDescendant, setActiveDescendant] = useState<string>('');

  // Virtual list configuration for large option sets
  const virtualizer = useVirtualizer({
    count: options.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 48, // Material Design 3 standard list item height
    overscan: 5,
    enabled: options.length > virtualizeThreshold
  });

  // Handle keyboard navigation and search
  const handleKeyDown = useCallback((event: React.KeyboardEvent) => {
    switch (event.key) {
      case 'ArrowDown':
      case 'ArrowUp':
        event.preventDefault();
        const currentIndex = options.findIndex(opt => opt.value === activeDescendant);
        const nextIndex = event.key === 'ArrowDown' 
          ? Math.min(currentIndex + 1, options.length - 1)
          : Math.max(currentIndex - 1, 0);
        setActiveDescendant(options[nextIndex].value);
        virtualizer.scrollToIndex(nextIndex);
        break;

      case ' ':
        if (searchQuery) {
          event.preventDefault();
          setSearchQuery(prev => prev + ' ');
        }
        break;

      default:
        // Implement type-ahead search
        if (event.key.length === 1) {
          setSearchQuery(prev => {
            const newQuery = prev + event.key;
            const matchedOption = options.find(opt => 
              opt.label.toLowerCase().startsWith(newQuery.toLowerCase())
            );
            if (matchedOption) {
              setActiveDescendant(matchedOption.value);
              virtualizer.scrollToIndex(
                options.findIndex(opt => opt.value === matchedOption.value)
              );
            }
            return newQuery;
          });

          // Clear search query after delay
          setTimeout(() => setSearchQuery(''), 1000);
        }
        break;
    }
  }, [options, activeDescendant, searchQuery, virtualizer]);

  // Handle dropdown open/close
  const handleOpen = useCallback(() => {
    setIsOpen(true);
    // Set initial active descendant
    if (typeof value === 'string' && value) {
      setActiveDescendant(value);
    }
  }, [value]);

  const handleClose = useCallback(() => {
    setIsOpen(false);
    setSearchQuery('');
  }, []);

  // Handle change with validation integration
  const handleChange = useCallback((event: SelectChangeEvent<string | string[]>) => {
    onChange(event.target.value, event);
  }, [onChange]);

  // Generate unique IDs for accessibility
  const labelId = `${id}-label`;
  const helperId = `${id}-helper`;

  return (
    <FormControl
      fullWidth={fullWidth}
      error={error}
      disabled={disabled}
      required={required}
      className={`dropdown-root ${error ? 'dropdown-error' : ''}`}
    >
      <InputLabel
        id={labelId}
        className="dropdown-label"
        shrink={!!value}
      >
        {label}
      </InputLabel>

      <Select
        id={id}
        labelId={labelId}
        value={value}
        multiple={multiple}
        onChange={handleChange}
        onBlur={onBlur}
        onOpen={handleOpen}
        onClose={handleClose}
        onKeyDown={handleKeyDown}
        open={isOpen}
        aria-label={ariaLabel || label}
        aria-describedby={ariaDescribedBy || (helperText ? helperId : undefined)}
        aria-invalid={error}
        aria-required={required}
        aria-activedescendant={isOpen ? activeDescendant : undefined}
        className="dropdown-select"
        MenuProps={{
          PaperProps: {
            ref: parentRef,
            style: { maxHeight: 300 }
          },
          variant: 'menu',
          anchorOrigin: {
            vertical: 'bottom',
            horizontal: 'left'
          },
          transformOrigin: {
            vertical: 'top',
            horizontal: 'left'
          }
        }}
      >
        {virtualizer.getVirtualItems().map(virtualRow => {
          const option = options[virtualRow.index];
          return (
            <MenuItem
              key={option.value}
              value={option.value}
              disabled={option.disabled}
              id={`${id}-option-${option.value}`}
              aria-selected={value === option.value}
              style={{
                height: virtualRow.size,
                transform: `translateY(${virtualRow.start}px)`
              }}
              className={`dropdown-menu-item ${
                activeDescendant === option.value ? 'dropdown-menu-item-active' : ''
              }`}
            >
              {option.label}
            </MenuItem>
          );
        })}
      </Select>

      {helperText && (
        <FormHelperText
          id={helperId}
          error={error}
          className="dropdown-helper-text"
        >
          {helperText}
        </FormHelperText>
      )}
    </FormControl>
  );
};

export default Dropdown;