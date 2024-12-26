import React, { useState, useCallback, useRef, useEffect } from 'react';
import { styled } from '@mui/material/styles';
import { TabsUnstyled } from '@mui/base';
import '../../styles/theme.css';

// Interfaces
interface TabItem {
  label: string;
  content: React.ReactNode;
  disabled?: boolean;
}

interface TabsProps {
  tabs: TabItem[];
  defaultValue?: number;
  orientation?: 'horizontal' | 'vertical';
  onChange?: (value: number) => void;
  className?: string;
}

// Styled Components
const StyledTabs = styled('div')<{ orientation?: 'horizontal' | 'vertical' }>(
  ({ theme, orientation = 'horizontal' }) => ({
    display: 'flex',
    flexDirection: orientation === 'horizontal' ? 'column' : 'row',
    width: '100%',
    position: 'relative',
    
    // Responsive styles
    [theme.breakpoints.down('sm')]: {
      flexDirection: 'column', // Always stack on mobile
    },

    '& .tabs-list': {
      display: 'flex',
      flexDirection: orientation === 'horizontal' ? 'row' : 'column',
      borderBottom: orientation === 'horizontal' ? 
        `1px solid ${theme.palette.divider}` : 'none',
      borderRight: orientation === 'vertical' ? 
        `1px solid ${theme.palette.divider}` : 'none',
      
      // Touch-friendly sizing for mobile
      [theme.breakpoints.down('sm')]: {
        flexDirection: 'row',
        width: '100%',
        overflowX: 'auto',
        scrollSnapType: 'x mandatory',
      },
    },

    '& .tab-button': {
      minHeight: 48,
      minWidth: 90,
      padding: theme.spacing(1.5, 2),
      color: theme.palette.text.secondary,
      cursor: 'pointer',
      border: 'none',
      background: 'none',
      fontSize: theme.typography.body1.fontSize,
      fontFamily: theme.typography.fontFamily,
      position: 'relative',
      transition: theme.transitions.create(['color', 'background-color']),

      '&:hover': {
        backgroundColor: theme.palette.action.hover,
      },

      '&:focus-visible': {
        outline: `2px solid ${theme.palette.primary.main}`,
        outlineOffset: 2,
      },

      '&[aria-selected="true"]': {
        color: theme.palette.primary.main,
        fontWeight: theme.typography.fontWeightMedium,
        
        '&::after': {
          content: '""',
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: 2,
          backgroundColor: theme.palette.primary.main,
        },
      },

      '&[aria-disabled="true"]': {
        color: theme.palette.text.disabled,
        cursor: 'not-allowed',
      },

      // Touch target size compliance
      [theme.breakpoints.down('sm')]: {
        minHeight: 44,
        minWidth: 44,
        scrollSnapAlign: 'start',
      },
    },
  })
);

const StyledTabPanel = styled('div')(({ theme }) => ({
  padding: theme.spacing(3),
  flex: 1,
  
  '&[hidden]': {
    display: 'none',
  },

  // Ensure content is visible when focused
  '&:focus': {
    outline: 'none',
  },

  '&:focus-visible': {
    outline: `2px solid ${theme.palette.primary.main}`,
    outlineOffset: 2,
  },
}));

// Main Component
export const Tabs: React.FC<TabsProps> = ({
  tabs,
  defaultValue = 0,
  orientation = 'horizontal',
  onChange,
  className,
}) => {
  const [activeTab, setActiveTab] = useState(defaultValue);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const panelRefs = useRef<(HTMLDivElement | null)[]>([]);

  // Handle tab change with accessibility
  const handleTabChange = useCallback((newValue: number) => {
    if (newValue < 0 || newValue >= tabs.length || tabs[newValue].disabled) {
      return;
    }

    setActiveTab(newValue);
    onChange?.(newValue);

    // Focus management
    requestAnimationFrame(() => {
      panelRefs.current[newValue]?.focus();
    });

    // Announce tab change to screen readers
    const announcement = `${tabs[newValue].label} tab activated`;
    const announcer = document.createElement('div');
    announcer.setAttribute('aria-live', 'polite');
    announcer.textContent = announcement;
    document.body.appendChild(announcer);
    setTimeout(() => document.body.removeChild(announcer), 1000);
  }, [tabs, onChange]);

  // Keyboard navigation
  const handleKeyDown = useCallback((event: React.KeyboardEvent) => {
    const isHorizontal = orientation === 'horizontal';
    const currentIndex = activeTab;
    let newIndex = currentIndex;

    switch (event.key) {
      case 'ArrowLeft':
      case 'ArrowUp':
        newIndex = currentIndex - 1;
        if (newIndex < 0) newIndex = tabs.length - 1;
        event.preventDefault();
        break;
      case 'ArrowRight':
      case 'ArrowDown':
        newIndex = currentIndex + 1;
        if (newIndex >= tabs.length) newIndex = 0;
        event.preventDefault();
        break;
      case 'Home':
        newIndex = 0;
        event.preventDefault();
        break;
      case 'End':
        newIndex = tabs.length - 1;
        event.preventDefault();
        break;
    }

    // Skip disabled tabs
    while (tabs[newIndex].disabled && newIndex !== currentIndex) {
      newIndex = newIndex === tabs.length - 1 ? 0 : newIndex + 1;
    }

    if (newIndex !== currentIndex) {
      handleTabChange(newIndex);
      tabRefs.current[newIndex]?.focus();
    }
  }, [activeTab, orientation, tabs, handleTabChange]);

  // Set up refs on mount
  useEffect(() => {
    tabRefs.current = tabRefs.current.slice(0, tabs.length);
    panelRefs.current = panelRefs.current.slice(0, tabs.length);
  }, [tabs.length]);

  return (
    <StyledTabs orientation={orientation} className={className}>
      <div
        className="tabs-list"
        role="tablist"
        aria-orientation={orientation}
        onKeyDown={handleKeyDown}
      >
        {tabs.map((tab, index) => (
          <button
            key={index}
            ref={el => tabRefs.current[index] = el}
            role="tab"
            className="tab-button"
            aria-selected={activeTab === index}
            aria-controls={`panel-${index}`}
            aria-disabled={tab.disabled}
            tabIndex={activeTab === index ? 0 : -1}
            onClick={() => !tab.disabled && handleTabChange(index)}
            disabled={tab.disabled}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {tabs.map((tab, index) => (
        <StyledTabPanel
          key={index}
          ref={el => panelRefs.current[index] = el}
          role="tabpanel"
          id={`panel-${index}`}
          aria-labelledby={`tab-${index}`}
          tabIndex={0}
          hidden={activeTab !== index}
        >
          {tab.content}
        </StyledTabPanel>
      ))}
    </StyledTabs>
  );
};

export type { TabsProps, TabItem };