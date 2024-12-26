// @mui/material v5.x
import { Box, Container, Typography, Link, useMediaQuery, Stack } from '@mui/material';
import { styled } from '@mui/material/styles';
// @react-i18next v12.x
import { useTranslation } from 'react-i18next';
import { memo } from 'react';

// Internal imports
import { useTheme } from '../../../hooks/useTheme';

// Styled components for theme-aware styling
const FooterLink = styled(Link)(({ theme }) => ({
  color: theme.palette.text.secondary,
  textDecoration: 'none',
  '&:hover': {
    textDecoration: 'underline',
    color: theme.palette.primary.main,
  },
  '&:focus': {
    outline: `${theme.spacing(0.5)} solid ${theme.palette.primary.main}`,
    outlineOffset: theme.spacing(0.5),
  },
  padding: theme.spacing(0.5, 1),
  borderRadius: theme.shape.borderRadius,
}));

const FooterSection = styled(Stack)(({ theme }) => ({
  [theme.breakpoints.down('sm')]: {
    alignItems: 'center',
    textAlign: 'center',
  },
}));

/**
 * Footer component providing navigation links and copyright information
 * with comprehensive accessibility support and responsive design.
 * 
 * @returns {JSX.Element} Rendered footer component
 */
const Footer = memo(() => {
  const { currentTheme, themeMode } = useTheme();
  const { t } = useTranslation();
  
  // Responsive breakpoints
  const isMobile = useMediaQuery(currentTheme.breakpoints.down('sm'));
  const isTablet = useMediaQuery(currentTheme.breakpoints.between('sm', 'md'));
  
  // Dynamic spacing based on viewport
  const spacing = {
    xs: 2, // 8px
    sm: 3, // 12px
    md: 4, // 16px
  };

  const currentYear = new Date().getFullYear();

  return (
    <Box
      component="footer"
      role="contentinfo"
      aria-label={t('footer.ariaLabel')}
      sx={{
        py: spacing,
        px: { xs: 1, sm: 2, md: 3 },
        mt: 'auto',
        backgroundColor: 'background.paper',
        borderTop: 1,
        borderColor: 'divider',
      }}
    >
      <Container maxWidth="lg">
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={spacing}
          justifyContent="space-between"
          alignItems={{ xs: 'center', sm: 'flex-start' }}
        >
          {/* Copyright Section */}
          <FooterSection>
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{ mb: { xs: 1, sm: 0 } }}
            >
              © {currentYear} {t('footer.copyright')}
            </Typography>
          </FooterSection>

          {/* Primary Links */}
          <FooterSection
            direction={{ xs: 'column', sm: 'row' }}
            spacing={{ xs: 1, sm: 2 }}
          >
            <FooterLink
              href="/privacy"
              aria-label={t('footer.privacy.ariaLabel')}
            >
              {t('footer.privacy.text')}
            </FooterLink>
            <FooterLink
              href="/terms"
              aria-label={t('footer.terms.ariaLabel')}
            >
              {t('footer.terms.text')}
            </FooterLink>
            <FooterLink
              href="/accessibility"
              aria-label={t('footer.accessibility.ariaLabel')}
            >
              {t('footer.accessibility.text')}
            </FooterLink>
          </FooterSection>

          {/* Secondary Links */}
          <FooterSection
            direction={{ xs: 'column', sm: 'row' }}
            spacing={{ xs: 1, sm: 2 }}
          >
            <FooterLink
              href="/contact"
              aria-label={t('footer.contact.ariaLabel')}
            >
              {t('footer.contact.text')}
            </FooterLink>
            <FooterLink
              href="/help"
              aria-label={t('footer.help.ariaLabel')}
            >
              {t('footer.help.text')}
            </FooterLink>
          </FooterSection>
        </Stack>

        {/* Additional Information for Mobile */}
        {isMobile && (
          <Typography
            variant="caption"
            color="text.secondary"
            align="center"
            sx={{ mt: 2 }}
          >
            {t('footer.mobileInfo')}
          </Typography>
        )}
      </Container>
    </Box>
  );
});

// Display name for debugging
Footer.displayName = 'Footer';

export default Footer;