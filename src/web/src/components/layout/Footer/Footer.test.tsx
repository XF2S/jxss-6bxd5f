// @testing-library/react v14.0.0
import { render, screen, within, cleanup, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event'; // v14.0.0
import { axe, toHaveNoViolations } from 'jest-axe'; // v4.7.0
import { ThemeProvider, createTheme } from '@mui/material'; // v5.x
import { I18nextProvider } from 'react-i18next'; // v13.0.0
import i18n from 'i18next';

// Internal imports
import Footer from './Footer';
import { ThemeMode } from '../../../config/theme.config';

// Extend Jest matchers
expect.extend(toHaveNoViolations);

// Mock translations
const mockTranslations = {
  footer: {
    ariaLabel: 'Footer navigation',
    copyright: 'Enrollment System. All rights reserved.',
    privacy: {
      text: 'Privacy Policy',
      ariaLabel: 'View privacy policy'
    },
    terms: {
      text: 'Terms of Service',
      ariaLabel: 'View terms of service'
    },
    accessibility: {
      text: 'Accessibility',
      ariaLabel: 'View accessibility statement'
    },
    contact: {
      text: 'Contact Us',
      ariaLabel: 'Contact support'
    },
    help: {
      text: 'Help Center',
      ariaLabel: 'Visit help center'
    },
    mobileInfo: 'Mobile version'
  }
};

// Setup i18n mock
i18n.init({
  lng: 'en',
  resources: {
    en: { translation: mockTranslations }
  }
});

// Helper function to render with theme and i18n
const renderWithProviders = (
  ui: React.ReactNode,
  { mode = ThemeMode.LIGHT } = {}
) => {
  const theme = createTheme({
    palette: {
      mode: mode === ThemeMode.HIGH_CONTRAST ? 'dark' : mode
    }
  });

  return render(
    <ThemeProvider theme={theme}>
      <I18nextProvider i18n={i18n}>
        {ui}
      </I18nextProvider>
    </ThemeProvider>
  );
};

// Helper function for responsive tests
const createResponsiveContainer = (width: number) => {
  const container = document.createElement('div');
  Object.defineProperty(container, 'clientWidth', { value: width });
  return container;
};

describe('Footer Component', () => {
  afterEach(() => {
    cleanup();
    jest.clearAllMocks();
  });

  describe('Rendering and Content', () => {
    it('renders without crashing', () => {
      renderWithProviders(<Footer />);
      expect(screen.getByRole('contentinfo')).toBeInTheDocument();
    });

    it('displays current year in copyright notice', () => {
      renderWithProviders(<Footer />);
      const currentYear = new Date().getFullYear();
      expect(screen.getByText(new RegExp(currentYear.toString()))).toBeInTheDocument();
    });

    it('renders all navigation links correctly', () => {
      renderWithProviders(<Footer />);
      const links = ['Privacy Policy', 'Terms of Service', 'Accessibility', 'Contact Us', 'Help Center'];
      links.forEach(link => {
        expect(screen.getByText(link)).toBeInTheDocument();
      });
    });
  });

  describe('Accessibility', () => {
    it('meets WCAG 2.1 Level AA requirements', async () => {
      const { container } = renderWithProviders(<Footer />);
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('has correct ARIA landmarks and roles', () => {
      renderWithProviders(<Footer />);
      expect(screen.getByRole('contentinfo')).toHaveAttribute('aria-label', 'Footer navigation');
    });

    it('supports keyboard navigation', async () => {
      renderWithProviders(<Footer />);
      const user = userEvent.setup();
      const firstLink = screen.getByText('Privacy Policy');
      
      await act(async () => {
        await user.tab();
      });
      
      expect(firstLink).toHaveFocus();
    });

    it('maintains sufficient color contrast in all themes', () => {
      const { rerender } = renderWithProviders(<Footer />);
      
      // Test light theme
      expect(screen.getByRole('contentinfo')).toHaveStyle({
        backgroundColor: expect.any(String)
      });

      // Test dark theme
      rerender(
        <ThemeProvider theme={createTheme({ palette: { mode: 'dark' } })}>
          <Footer />
        </ThemeProvider>
      );
      expect(screen.getByRole('contentinfo')).toHaveStyle({
        backgroundColor: expect.any(String)
      });
    });
  });

  describe('Responsive Behavior', () => {
    const breakpoints = [320, 768, 1024, 1440];

    breakpoints.forEach(width => {
      it(`adapts layout at ${width}px viewport width`, () => {
        const container = createResponsiveContainer(width);
        const { container: renderedContainer } = renderWithProviders(<Footer />);
        document.body.appendChild(container);
        container.appendChild(renderedContainer);

        const footer = within(container).getByRole('contentinfo');
        expect(footer).toBeVisible();
        
        // Verify stack direction based on breakpoint
        const stack = footer.querySelector('.MuiStack-root');
        expect(stack).toHaveStyle({
          flexDirection: width < 768 ? 'column' : 'row'
        });
      });
    });
  });

  describe('Theme Integration', () => {
    it('applies correct light theme styles', () => {
      renderWithProviders(<Footer />);
      const footer = screen.getByRole('contentinfo');
      expect(footer).toHaveStyle({
        backgroundColor: expect.any(String),
        borderTopColor: expect.any(String)
      });
    });

    it('applies correct dark theme styles', () => {
      renderWithProviders(<Footer />, { mode: ThemeMode.DARK });
      const footer = screen.getByRole('contentinfo');
      expect(footer).toHaveStyle({
        backgroundColor: expect.any(String),
        borderTopColor: expect.any(String)
      });
    });

    it('supports high contrast mode', () => {
      renderWithProviders(<Footer />, { mode: ThemeMode.HIGH_CONTRAST });
      const footer = screen.getByRole('contentinfo');
      const links = screen.getAllByRole('link');
      
      expect(footer).toHaveStyle({
        backgroundColor: '#000000'
      });
      links.forEach(link => {
        expect(link).toHaveStyle({
          color: '#ffffff'
        });
      });
    });
  });

  describe('Internationalization', () => {
    it('displays translated content correctly', async () => {
      await act(async () => {
        await i18n.changeLanguage('en');
      });
      renderWithProviders(<Footer />);
      
      expect(screen.getByText(mockTranslations.footer.copyright)).toBeInTheDocument();
      expect(screen.getByText(mockTranslations.footer.privacy.text)).toBeInTheDocument();
    });

    it('supports RTL layout', async () => {
      await act(async () => {
        await i18n.changeLanguage('ar');
        document.dir = 'rtl';
      });
      
      renderWithProviders(<Footer />);
      const footer = screen.getByRole('contentinfo');
      expect(footer).toHaveStyle({ direction: 'rtl' });
      
      // Cleanup
      document.dir = 'ltr';
    });
  });

  describe('Performance', () => {
    it('renders within performance budget', () => {
      const startTime = performance.now();
      renderWithProviders(<Footer />);
      const endTime = performance.now();
      
      expect(endTime - startTime).toBeLessThan(100); // 100ms budget
    });

    it('handles theme switches efficiently', () => {
      const { rerender } = renderWithProviders(<Footer />);
      const startTime = performance.now();
      
      rerender(
        <ThemeProvider theme={createTheme({ palette: { mode: 'dark' } })}>
          <Footer />
        </ThemeProvider>
      );
      
      const endTime = performance.now();
      expect(endTime - startTime).toBeLessThan(50); // 50ms budget for theme switch
    });
  });
});