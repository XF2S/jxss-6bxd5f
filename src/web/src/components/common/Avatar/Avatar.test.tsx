/**
 * @fileoverview Test suite for Avatar component
 * Implements comprehensive testing for rendering, accessibility, and theme integration
 * @version 1.0.0
 */

// External imports - versions specified in package.json
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react'; // v14.0.0
import { axe, toHaveNoViolations } from 'jest-axe'; // v4.7.3
import '@testing-library/jest-dom/extend-expect'; // v5.16.5

// Internal imports
import Avatar from './Avatar';
import { ThemeProvider, createCustomTheme, ThemeMode } from '@/config/theme.config';
import type { User } from '@/types/auth.types';

// Extend Jest matchers
expect.extend(toHaveNoViolations);

/**
 * Helper function to render components with theme context
 */
const renderWithTheme = (
  children: React.ReactNode,
  mode: ThemeMode = ThemeMode.LIGHT
) => {
  const theme = createCustomTheme(mode);
  return render(
    <ThemeProvider theme={theme}>
      {children}
    </ThemeProvider>
  );
};

// Mock data
const mockUser: User = {
  id: '123',
  email: 'john.doe@example.com',
  firstName: 'John',
  lastName: 'Doe',
  roles: ['APPLICANT'],
  status: 'ACTIVE',
  mfaEnabled: false,
  lastLoginAt: new Date(),
  createdAt: new Date()
};

const mockImageUrl = 'https://example.com/avatar.jpg';

describe('Avatar Component', () => {
  // Basic rendering tests
  describe('Rendering', () => {
    it('renders with image source', () => {
      renderWithTheme(<Avatar src={mockImageUrl} alt="Test Avatar" />);
      const avatar = screen.getByRole('img');
      expect(avatar).toBeInTheDocument();
      expect(avatar).toHaveAttribute('src', mockImageUrl);
      expect(avatar).toHaveAttribute('alt', 'Test Avatar');
    });

    it('renders with user data', () => {
      renderWithTheme(<Avatar user={mockUser} />);
      const avatar = screen.getByRole('img');
      expect(avatar).toBeInTheDocument();
      expect(avatar).toHaveAttribute('alt', 'John Doe');
    });

    it('renders initials when no image is provided', () => {
      renderWithTheme(<Avatar user={mockUser} src="" />);
      expect(screen.getByText('JD')).toBeInTheDocument();
    });

    it('renders fallback when no user or image is provided', () => {
      renderWithTheme(<Avatar />);
      expect(screen.getByText('?')).toBeInTheDocument();
    });
  });

  // Size variant tests
  describe('Size Variants', () => {
    it('applies correct size styles for small variant', () => {
      renderWithTheme(<Avatar size="small" user={mockUser} />);
      const avatar = screen.getByRole('img');
      expect(avatar).toHaveStyle({ width: '32px', height: '32px' });
    });

    it('applies correct size styles for medium variant', () => {
      renderWithTheme(<Avatar size="medium" user={mockUser} />);
      const avatar = screen.getByRole('img');
      expect(avatar).toHaveStyle({ width: '40px', height: '40px' });
    });

    it('applies correct size styles for large variant', () => {
      renderWithTheme(<Avatar size="large" user={mockUser} />);
      const avatar = screen.getByRole('img');
      expect(avatar).toHaveStyle({ width: '48px', height: '48px' });
    });
  });

  // Theme integration tests
  describe('Theme Integration', () => {
    it('applies correct styles in light theme', () => {
      renderWithTheme(<Avatar user={mockUser} />, ThemeMode.LIGHT);
      const avatar = screen.getByRole('img');
      expect(avatar).toHaveStyle({
        backgroundColor: '#1976d2',
        color: '#ffffff'
      });
    });

    it('applies correct styles in dark theme', () => {
      renderWithTheme(<Avatar user={mockUser} />, ThemeMode.DARK);
      const avatar = screen.getByRole('img');
      expect(avatar).toHaveStyle({
        backgroundColor: '#90caf9',
        color: '#000000'
      });
    });

    it('applies correct styles in high contrast theme', () => {
      renderWithTheme(<Avatar user={mockUser} />, ThemeMode.HIGH_CONTRAST);
      const avatar = screen.getByRole('img');
      expect(avatar).toHaveStyle({
        backgroundColor: '#000000',
        color: '#ffffff'
      });
    });
  });

  // Accessibility tests
  describe('Accessibility', () => {
    it('meets WCAG 2.1 accessibility guidelines', async () => {
      const { container } = renderWithTheme(<Avatar user={mockUser} />);
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('provides correct ARIA attributes for interactive avatar', () => {
      const handleClick = jest.fn();
      renderWithTheme(<Avatar user={mockUser} onClick={handleClick} />);
      const avatar = screen.getByRole('button');
      expect(avatar).toHaveAttribute('aria-label', 'John Doe profile');
      expect(avatar).toHaveAttribute('tabIndex', '0');
    });

    it('handles keyboard navigation correctly', () => {
      const handleClick = jest.fn();
      renderWithTheme(<Avatar user={mockUser} onClick={handleClick} />);
      const avatar = screen.getByRole('button');
      
      // Test keyboard interaction
      fireEvent.keyPress(avatar, { key: 'Enter', code: 'Enter' });
      expect(handleClick).toHaveBeenCalled();
      
      // Test focus styles
      fireEvent.focus(avatar);
      expect(avatar).toHaveStyle({
        boxShadow: expect.stringContaining('0 0 0 2px')
      });
    });
  });

  // Error handling tests
  describe('Error Handling', () => {
    it('handles image loading errors gracefully', async () => {
      renderWithTheme(<Avatar src="invalid-url.jpg" user={mockUser} />);
      const avatar = screen.getByRole('img');
      
      // Simulate image load error
      fireEvent.error(avatar);
      
      await waitFor(() => {
        expect(screen.getByText('JD')).toBeInTheDocument();
      });
    });

    it('handles missing user data gracefully', () => {
      renderWithTheme(<Avatar src="" />);
      expect(screen.getByText('?')).toBeInTheDocument();
    });
  });

  // Interactive behavior tests
  describe('Interactive Behavior', () => {
    it('handles click events correctly', () => {
      const handleClick = jest.fn();
      renderWithTheme(<Avatar user={mockUser} onClick={handleClick} />);
      
      const avatar = screen.getByRole('button');
      fireEvent.click(avatar);
      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it('applies hover styles correctly', () => {
      renderWithTheme(<Avatar user={mockUser} />);
      const avatar = screen.getByRole('img');
      
      fireEvent.mouseEnter(avatar);
      expect(avatar).toHaveStyle({
        borderColor: expect.stringContaining('#')
      });
    });
  });
});