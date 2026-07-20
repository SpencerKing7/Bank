// Bank! — "game-night bold" theme. Dark, cool green-cast neutrals;
// money green (primary) + gold (secondary) accents; danger red for busts.
import '@fontsource/bebas-neue';
import { createTheme } from '@mui/material/styles';

export const DISPLAY_FONT =
  '"Bebas Neue", "Arial Narrow", "Helvetica Neue", Impact, sans-serif';

export const BODY_FONT =
  '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';

// Number-grid tile colors (host roll pad). Not part of the MUI palette —
// import { tiles } from './theme' and use in sx.
export const tiles = {
  bg: '#1D2B24', //  default tile face
  bgPressed: '#27392E', //  :active / hover
  border: '#2E4136', //  1px tile outline
  text: '#F2F7F4',
  sevenSafe: {
    bg: '#0E3B24', //  rolls 1–3: the 7 is worth +70
    border: '#2BE080',
    text: '#7DF0B8',
  },
  sevenDanger: {
    bg: '#40060C', //  roll 4+: the 7 busts the round
    border: '#FF4D5E',
    text: '#FF9AA2',
  },
  disabled: {
    bg: '#141B17',
    text: '#5F6E65',
  },
} as const;

export const theme = createTheme({
  palette: {
    mode: 'dark',
    contrastThreshold: 4.5, // never auto-pick a sub-AA contrast text
    background: {
      default: '#0D1512', // near-black with a cool green cast (no pure #000)
      paper: '#16211C', //   cards, app bars
      // one level higher (drawer, dialogs, tiles): #1D2B24 — apply via sx
    },
    primary: {
      main: '#2BE080', //    electric money green
      light: '#7DF0B8',
      dark: '#17A65B',
      contrastText: '#04170D',
    },
    secondary: {
      main: '#FFC94A', //    poker-chip gold
      light: '#FFD75E',
      dark: '#D9A527',
      contrastText: '#241A02',
    },
    error: {
      main: '#FF4D5E', //    bust red (fills)
      light: '#FF6B76', //   red used AS TEXT on dark surfaces
      dark: '#C22834',
      contrastText: '#2B0509',
    },
    success: {
      main: '#25C46F', //    quieter sibling of primary ("banked" states)
      light: '#6FE8AC',
      dark: '#178A4C',
      contrastText: '#04170D',
    },
    warning: {
      main: '#FFA726',
      contrastText: '#241A02',
    },
    text: {
      primary: '#F2F7F4', // off-white (no pure #fff)
      secondary: '#A9BBB1',
      disabled: '#5F6E65',
    },
    divider: '#2A3A31',
    action: {
      hover: 'rgba(43, 224, 128, 0.08)',
      selected: 'rgba(43, 224, 128, 0.16)',
      disabledBackground: '#141B17',
      disabled: '#5F6E65',
    },
  },

  shape: {
    borderRadius: 14,
  },

  spacing: 8,

  typography: {
    fontFamily: BODY_FONT,
    // h1 — the GIANT live round total (Game screen hero)
    h1: {
      fontFamily: DISPLAY_FONT,
      fontSize: 'clamp(5rem, 28vw, 10rem)',
      fontWeight: 400, // Bebas Neue ships one weight; fallback stays bold via size
      lineHeight: 1,
      letterSpacing: '0.02em',
      fontVariantNumeric: 'tabular-nums', // digits don't jiggle as the total ticks
    },
    // h2 — the giant 4-letter game code (Lobby)
    h2: {
      fontFamily: DISPLAY_FONT,
      fontSize: 'clamp(4rem, 22vw, 8rem)',
      fontWeight: 400,
      lineHeight: 1,
      letterSpacing: '0.1em',
    },
    // h3 — app title "Bank!" (Home), winner name (Game Over)
    h3: {
      fontFamily: DISPLAY_FONT,
      fontSize: 'clamp(3rem, 14vw, 4.5rem)',
      fontWeight: 400,
      lineHeight: 1.05,
      letterSpacing: '0.03em',
    },
    // h4 — screen headings ("Game Over", "Lobby")
    h4: {
      fontFamily: DISPLAY_FONT,
      fontSize: '2rem',
      fontWeight: 400,
      letterSpacing: '0.04em',
    },
    // h6 — section headers ("Players", "Standings")
    h6: {
      fontSize: '1.125rem',
      fontWeight: 700,
      letterSpacing: '0.01em',
    },
    // overline — the "· ROLL 4" tail beside the round counter, and small
    // section labels ("Game code"). The round counter itself is display-font
    // and set inline in RoundHeader.
    overline: {
      fontSize: '0.8125rem',
      fontWeight: 700,
      letterSpacing: '0.14em',
      lineHeight: 2,
    },
    body1: { fontSize: '1.0625rem', lineHeight: 1.5 }, // 17px — grandparent-legible
    body2: { fontSize: '0.9375rem', lineHeight: 1.45 },
    button: {
      fontSize: '1.0625rem',
      fontWeight: 800,
      letterSpacing: '0.02em',
      textTransform: 'none',
    },
  },

  components: {
    MuiCssBaseline: {
      styleOverrides: `
        body {
          background-color: #0D1512;
          background-image: radial-gradient(
            120% 90% at 50% 0%,
            #142019 0%,
            #0D1512 60%
          );
          background-attachment: fixed;
          -webkit-font-smoothing: antialiased;
        }
        @keyframes bustShake {
          0%, 100% { transform: translateX(0); }
          15% { transform: translateX(-10px); }
          30% { transform: translateX(9px); }
          45% { transform: translateX(-7px); }
          60% { transform: translateX(5px); }
          75% { transform: translateX(-3px); }
          90% { transform: translateX(2px); }
        }
        @keyframes bustFlash {
          0% { color: #FF6B76; text-shadow: 0 0 48px rgba(255, 77, 94, 0.9); }
          100% { color: inherit; text-shadow: none; }
        }
        @keyframes totalPop {
          0% { transform: scale(1); }
          40% { transform: scale(1.06); }
          100% { transform: scale(1); }
        }
        @keyframes winnerGlow {
          0%, 100% { text-shadow: 0 0 24px rgba(255, 201, 74, 0.45); }
          50% { text-shadow: 0 0 56px rgba(255, 201, 74, 0.85); }
        }
        /* The FINAL ROUND chip breathes for as long as the round lasts. */
        @keyframes finalRoundPulse {
          0%, 100% {
            box-shadow: 0 0 0 rgba(255, 201, 74, 0);
            border-color: rgba(255, 201, 74, 0.55);
          }
          50% {
            box-shadow: 0 0 20px rgba(255, 201, 74, 0.5);
            border-color: rgba(255, 201, 74, 1);
          }
        }
        /* One-shot gold wash across the viewport on entering the last round. */
        @keyframes finalRoundSweep {
          0% { opacity: 0; transform: translateY(-100%); }
          35% { opacity: 1; }
          100% { opacity: 0; transform: translateY(100%); }
        }
        @media (prefers-reduced-motion: reduce) {
          *, *::before, *::after {
            animation-duration: 0.01ms !important;
            animation-iteration-count: 1 !important;
            transition-duration: 0.01ms !important;
          }
        }
      `,
    },

    MuiButton: {
      defaultProps: {
        disableElevation: true,
        size: 'large',
      },
      styleOverrides: {
        root: {
          borderRadius: 14,
          minHeight: 48,
          paddingLeft: 24,
          paddingRight: 24,
        },
        sizeLarge: {
          minHeight: 56,
          fontSize: '1.125rem',
        },
        containedPrimary: {
          '&:active': { backgroundColor: '#17A65B' },
        },
        outlined: {
          borderWidth: 2,
          '&:hover': { borderWidth: 2 },
        },
      },
    },

    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none', // kill MUI's dark-mode elevation tint; hexes stay exact
        },
      },
    },

    MuiCard: {
      styleOverrides: {
        root: {
          backgroundColor: '#16211C',
          border: '1px solid #2A3A31',
        },
      },
    },

    MuiDrawer: {
      styleOverrides: {
        paperAnchorBottom: {
          backgroundColor: '#1D2B24',
          borderTopLeftRadius: 20,
          borderTopRightRadius: 20,
          borderTop: '1px solid #2E4136',
          maxHeight: '80vh',
          paddingBottom: 'env(safe-area-inset-bottom)',
        },
      },
    },

    MuiChip: {
      styleOverrides: {
        root: {
          fontWeight: 700,
          '&.MuiChip-colorSuccess.MuiChip-filled': {
            backgroundColor: '#25C46F',
            color: '#04170D',
          },
        },
      },
    },

    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          backgroundColor: '#16211C',
          borderRadius: 14,
          '& .MuiOutlinedInput-notchedOutline': { borderColor: '#2E4136' },
          '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#5F6E65' },
        },
        input: {
          minHeight: '1.4375em',
          fontSize: '1.0625rem',
        },
      },
    },

    MuiListItemButton: {
      styleOverrides: {
        root: {
          borderRadius: 14,
          minHeight: 56,
        },
      },
    },

    MuiToggleButton: {
      styleOverrides: {
        root: {
          minHeight: 48,
          fontWeight: 800,
          color: '#A9BBB1',
          borderColor: '#2E4136',
          '&.Mui-selected': {
            backgroundColor: 'rgba(43, 224, 128, 0.16)',
            color: '#7DF0B8',
          },
        },
      },
    },
  },
});

export default theme;
