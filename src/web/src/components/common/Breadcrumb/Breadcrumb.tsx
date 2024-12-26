import React, { useCallback, KeyboardEvent } from 'react';
import { Breadcrumbs, Link, Typography } from '@mui/material'; // @mui/material ^5.0.0
import { styled } from '@mui/material/styles'; // @mui/material/styles ^5.0.0
import { NavigateNext } from '@mui/icons-material'; // @mui/icons-material ^5.0.0

// Interfaces
interface BreadcrumbItem {
  label: string;
  path: string;
  active: boolean;
}

interface BreadcrumbProps {
  items: BreadcrumbItem[];
  className?: string;
  separator?: React.ReactNode;
  maxItems?: number;
  itemsBeforeCollapse?: number;
  itemsAfterCollapse?: number;
}

// Styled Components
const StyledBreadcrumbs = styled(Breadcrumbs)(({ theme }) => ({
  padding: theme.spacing(1, 0),
  '& .MuiBreadcrumbs-ol': {
    margin: 0,
    padding: 0,
    listStyle: 'none',
  },
  '& .MuiBreadcrumbs-li': {
    display: 'inline-flex',
    alignItems: 'center',
  },
  '& .MuiBreadcrumbs-separator': {
    marginLeft: theme.spacing(1),
    marginRight: theme.spacing(1),
    color: theme.palette.text.secondary,
  },
  '& a': {
    ...theme.typography.body2,
    color: theme.palette.text.secondary,
    textDecoration: 'none',
    '&:hover': {
      color: theme.palette.primary.main,
      textDecoration: 'underline',
    },
    '&:focus': {
      outline: `2px solid ${theme.palette.primary.main}`,
      outlineOffset: '2px',
      borderRadius: '2px',
    },
  },
  '& .MuiBreadcrumbs-li:last-child': {
    ...theme.typography.body2,
    color: theme.palette.text.primary,
    fontWeight: theme.typography.fontWeightMedium,
  },
}));

/**
 * Breadcrumb Component
 * 
 * A reusable breadcrumb navigation component that provides hierarchical page location
 * tracking following Material Design 3 principles. Implements WCAG 2.1 Level AA compliance.
 *
 * @param {BreadcrumbProps} props - Component props
 * @returns {JSX.Element} Rendered breadcrumb component
 */
const Breadcrumb: React.FC<BreadcrumbProps> = React.memo(({
  items,
  className,
  separator = <NavigateNext fontSize="small" />,
  maxItems = 8,
  itemsBeforeCollapse = 1,
  itemsAfterCollapse = 1,
}) => {
  // Handle keyboard navigation
  const handleKeyPress = useCallback((event: KeyboardEvent<HTMLAnchorElement>, path: string) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      window.location.href = path;
    }
  }, []);

  // Handle responsive behavior based on screen size
  const getResponsiveMaxItems = () => {
    if (window.innerWidth < 600) return 3; // Mobile
    if (window.innerWidth < 960) return 5; // Tablet
    return maxItems; // Desktop
  };

  return (
    <nav aria-label="breadcrumb">
      <StyledBreadcrumbs
        className={className}
        separator={separator}
        maxItems={getResponsiveMaxItems()}
        itemsBeforeCollapse={itemsBeforeCollapse}
        itemsAfterCollapse={itemsAfterCollapse}
      >
        {items.map((item, index) => {
          const isLast = index === items.length - 1;

          if (isLast || item.active) {
            return (
              <Typography
                key={item.path}
                color="text.primary"
                aria-current="page"
                component="span"
                variant="body2"
              >
                {item.label}
              </Typography>
            );
          }

          return (
            <Link
              key={item.path}
              href={item.path}
              onClick={(e) => e.preventDefault()}
              onKeyPress={(e) => handleKeyPress(e, item.path)}
              color="inherit"
              underline="hover"
              aria-label={`Navigate to ${item.label}`}
              tabIndex={0}
              role="link"
            >
              {item.label}
            </Link>
          );
        })}
      </StyledBreadcrumbs>
    </nav>
  );
});

// Display name for debugging
Breadcrumb.displayName = 'Breadcrumb';

// Default props
Breadcrumb.defaultProps = {
  className: undefined,
  separator: <NavigateNext fontSize="small" />,
  maxItems: 8,
  itemsBeforeCollapse: 1,
  itemsAfterCollapse: 1,
};

export type { BreadcrumbItem, BreadcrumbProps };
export default Breadcrumb;