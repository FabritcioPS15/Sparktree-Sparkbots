import { createContext, useContext, useState, ReactNode, useEffect } from 'react';

export const STATUS_KEYS = [
  'pending', 'paid', 'cancelled', 'refunded', 'overdue',
  'sent', 'delivered', 'processing', 'returned',
  'active', 'inactive', 'error', 'success', 'warning', 'info',
  'connected', 'connecting', 'disconnected',
  'draft', 'accepted', 'rejected', 'expired',
] as const;

export const STATUS_GROUPS: { name: string; keys: typeof STATUS_KEYS[number][] }[] = [
  { name: 'Pagos', keys: ['pending', 'paid', 'cancelled', 'refunded', 'overdue'] },
  { name: 'Pedidos / Envíos', keys: ['pending', 'processing', 'sent', 'delivered', 'returned'] },
  { name: 'General', keys: ['active', 'inactive', 'error', 'success', 'warning', 'info'] },
  { name: 'Conexión', keys: ['connected', 'connecting', 'disconnected'] },
  { name: 'Cotizaciones', keys: ['draft', 'sent', 'accepted', 'rejected', 'expired'] },
];
export const BADGE_VARIANTS = ['primary', 'success', 'warning', 'danger', 'info', 'default'] as const;

interface CustomizationContextType {
  accentColor: string;
  customAccentHex: string;
  tableDensity: string;
  layoutMode: string;
  cardStyle: string;
  fontSize: string;
  fontFamily: string;
  radiusSize: string;
  statusColors: Record<string, string>;
  setAccentColor: (v: string) => void;
  setCustomAccentHex: (v: string) => void;
  setTableDensity: (v: string) => void;
  setLayoutMode: (v: string) => void;
  setCardStyle: (v: string) => void;
  setFontSize: (v: string) => void;
  setFontFamily: (v: string) => void;
  setRadiusSize: (v: string) => void;
  setStatusColor: (status: string, variant: string) => void;
}

const CustomizationContext = createContext<CustomizationContextType>(null!);

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const clean = hex.replace('#', '');
  if (clean.length !== 6) return null;
  const num = parseInt(clean, 16);
  if (isNaN(num)) return null;
  return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 };
}

function generateShadesFromHex(hex: string): Record<string, string> {
  const rgb = hexToRgb(hex);
  if (!rgb) return accentShades.emerald;
  const { r, g, b } = rgb;
  return {
    '50': `${Math.round(r + (255 - r) * 0.85)} ${Math.round(g + (255 - g) * 0.85)} ${Math.round(b + (255 - b) * 0.85)}`,
    '100': `${Math.round(r + (255 - r) * 0.7)} ${Math.round(g + (255 - g) * 0.7)} ${Math.round(b + (255 - b) * 0.7)}`,
    '200': `${Math.round(r + (255 - r) * 0.5)} ${Math.round(g + (255 - g) * 0.5)} ${Math.round(b + (255 - b) * 0.5)}`,
    '300': `${Math.round(r + (255 - r) * 0.3)} ${Math.round(g + (255 - g) * 0.3)} ${Math.round(b + (255 - b) * 0.3)}`,
    '400': `${Math.round(r + (255 - r) * 0.1)} ${Math.round(g + (255 - g) * 0.1)} ${Math.round(b + (255 - b) * 0.1)}`,
    '500': `${r} ${g} ${b}`,
    '600': `${Math.round(r * 0.8)} ${Math.round(g * 0.8)} ${Math.round(b * 0.8)}`,
    '700': `${Math.round(r * 0.6)} ${Math.round(g * 0.6)} ${Math.round(b * 0.6)}`,
    '800': `${Math.round(r * 0.4)} ${Math.round(g * 0.4)} ${Math.round(b * 0.4)}`,
    '900': `${Math.round(r * 0.25)} ${Math.round(g * 0.25)} ${Math.round(b * 0.25)}`,
    '950': `${Math.round(r * 0.1)} ${Math.round(g * 0.1)} ${Math.round(b * 0.1)}`,
  };
}

const accentShades: Record<string, Record<string, string>> = {
  emerald: {
    '50': '236 253 245', '100': '209 250 229', '200': '167 243 208',
    '300': '110 231 183', '400': '52 211 153', '500': '65 240 165',
    '600': '16 185 129', '700': '5 150 105', '800': '4 120 87',
    '900': '6 95 70', '950': '2 44 34',
  },
  blue: {
    '50': '239 246 255', '100': '219 234 254', '200': '191 219 254',
    '300': '147 197 253', '400': '96 165 250', '500': '59 130 246',
    '600': '37 99 235', '700': '29 78 216', '800': '30 64 175',
    '900': '30 58 138', '950': '23 37 84',
  },
  violet: {
    '50': '245 243 255', '100': '237 233 254', '200': '221 214 254',
    '300': '196 181 253', '400': '167 139 250', '500': '139 92 246',
    '600': '124 58 237', '700': '109 40 217', '800': '91 33 182',
    '900': '76 29 149', '950': '46 16 101',
  },
  rose: {
    '50': '255 241 242', '100': '255 228 235', '200': '254 205 215',
    '300': '253 164 185', '400': '251 113 133', '500': '244 63 94',
    '600': '225 29 72', '700': '190 18 60', '800': '159 18 57',
    '900': '136 19 55', '950': '76 5 25',
  },
  amber: {
    '50': '255 251 235', '100': '254 243 199', '200': '253 230 138',
    '300': '252 211 77', '400': '251 191 36', '500': '245 158 11',
    '600': '217 119 6', '700': '180 83 9', '800': '146 64 14',
    '900': '120 53 15', '950': '69 26 3',
  },
  cyan: {
    '50': '236 254 255', '100': '207 250 254', '200': '165 243 252',
    '300': '103 232 249', '400': '34 211 238', '500': '6 182 212',
    '600': '8 145 178', '700': '14 116 144', '800': '21 94 117',
    '900': '22 78 99', '950': '8 51 68',
  },
  indigo: {
    '50': '238 242 255', '100': '224 231 255', '200': '199 210 254',
    '300': '165 180 252', '400': '129 140 248', '500': '99 102 241',
    '600': '79 70 229', '700': '67 56 202', '800': '55 48 163',
    '900': '49 46 129', '950': '30 27 75',
  },
  orange: {
    '50': '255 247 237', '100': '255 237 213', '200': '254 215 170',
    '300': '253 186 116', '400': '251 146 60', '500': '249 115 22',
    '600': '234 88 12', '700': '194 65 12', '800': '154 52 18',
    '900': '124 45 18', '950': '67 20 7',
  },
  red: {
    '50': '254 242 242', '100': '254 226 226', '200': '254 202 202',
    '300': '252 165 165', '400': '248 113 113', '500': '239 68 68',
    '600': '220 38 38', '700': '185 28 28', '800': '153 27 27',
    '900': '127 29 29', '950': '69 10 10',
  },
  pink: {
    '50': '252 231 243', '100': '251 207 232', '200': '249 168 212',
    '300': '244 114 182', '400': '236 72 153', '500': '219 39 119',
    '600': '190 18 90', '700': '157 23 77', '800': '131 18 53',
    '900': '107 20 55', '950': '64 7 32',
  },
  lime: {
    '50': '247 254 231', '100': '236 252 203', '200': '217 249 157',
    '300': '190 244 96', '400': '163 230 53', '500': '132 204 22',
    '600': '101 163 13', '700': '77 124 15', '800': '63 98 18',
    '900': '54 83 20', '950': '26 46 5',
  },
  teal: {
    '50': '240 253 250', '100': '204 251 241', '200': '153 246 228',
    '300': '94 234 212', '400': '45 212 191', '500': '20 184 166',
    '600': '13 148 136', '700': '15 118 110', '800': '17 94 89',
    '900': '19 78 74', '950': '4 47 46',
  },
};

const radiusMap: Record<string, string> = {
  small: '8px',
  normal: '16px',
  large: '24px',
};

const densityPaddingMap: Record<string, string> = {
  compact: '6px 12px',
  normal: '12px 16px',
  spacious: '20px 24px',
};

const defaultStatusColors: Record<string, string> = {
  pending: 'warning', paid: 'success', cancelled: 'danger', refunded: 'info', overdue: 'danger',
  sent: 'info', delivered: 'success', processing: 'warning', returned: 'danger',
  active: 'primary', inactive: 'default', error: 'danger', success: 'success', warning: 'warning', info: 'info',
  connected: 'success', connecting: 'warning', disconnected: 'danger',
  draft: 'default', accepted: 'success', rejected: 'danger', expired: 'warning',
};

export const CustomizationProvider = ({ children }: { children: ReactNode }) => {
  const [accentColor, setAccentColor] = useState(() => localStorage.getItem('accent-color') || 'emerald');
  const [customAccentHex, setCustomAccentHex] = useState(() => localStorage.getItem('custom-accent-hex') || '#10b981');
  const [tableDensity, setTableDensity] = useState(() => localStorage.getItem('table-density') || 'normal');
  const [layoutMode, setLayoutMode] = useState(() => localStorage.getItem('layout-mode') || 'fluid');
  const [cardStyle, setCardStyle] = useState(() => localStorage.getItem('card-style') || 'bordered');
  const [fontSize, setFontSize] = useState(() => localStorage.getItem('font-size') || 'normal');
  const [fontFamily, setFontFamily] = useState(() => localStorage.getItem('font-family') || 'outfit');
  const [radiusSize, setRadiusSize] = useState(() => localStorage.getItem('radius-size') || 'normal');
  const [statusColors, setStatusColors] = useState<Record<string, string>>(() => {
    try { return JSON.parse(localStorage.getItem('status-colors') || 'null') || defaultStatusColors; }
    catch { return defaultStatusColors; }
  });

  const fontFamilyMap: Record<string, string> = {
    outfit: "'Outfit', 'Plus Jakarta Sans', 'Inter', sans-serif",
    inter: "'Outfit', 'Plus Jakarta Sans', 'Inter', sans-serif",
    system: "'Outfit', 'Plus Jakarta Sans', 'Inter', sans-serif",
    mono: "'JetBrains Mono', 'Fira Code', monospace",
    sans: "'Outfit', 'Plus Jakarta Sans', 'Inter', sans-serif",
    serif: "'Outfit', 'Plus Jakarta Sans', 'Inter', sans-serif",
  };

  useEffect(() => {
    const root = document.documentElement;
    let shades: Record<string, string>;

    if (accentColor === 'custom') {
      shades = generateShadesFromHex(customAccentHex);
    } else {
      shades = accentShades[accentColor] || accentShades.emerald;
    }

    Object.entries(shades).forEach(([shade, rgb]) => {
      root.style.setProperty(`--accent-${shade}`, rgb);
    });

    root.style.setProperty('--radius', radiusMap[radiusSize] || radiusMap.normal);
    root.style.setProperty('--table-cell-padding', densityPaddingMap[tableDensity] || densityPaddingMap.normal);
    root.style.setProperty('--font-family', fontFamilyMap[fontFamily] || fontFamilyMap.inter);

    root.setAttribute('data-accent', accentColor);
    root.setAttribute('data-density', tableDensity);
    root.setAttribute('data-layout', layoutMode);
    root.setAttribute('data-card-style', cardStyle);
    root.setAttribute('data-font-family', fontFamily);

    if (fontSize === 'small') root.style.fontSize = '13px';
    else if (fontSize === 'large') root.style.fontSize = '16px';
    else root.style.fontSize = '';
  }, [accentColor, customAccentHex, tableDensity, layoutMode, cardStyle, fontSize, fontFamily, radiusSize]);

  const update = (key: string, value: string, setter: (v: string) => void) => {
    setter(value);
    localStorage.setItem(key, value);
  };

  const setStatusColor = (status: string, variant: string) => {
    setStatusColors(prev => {
      const next = { ...prev, [status]: variant };
      localStorage.setItem('status-colors', JSON.stringify(next));
      return next;
    });
  };

  return (
    <CustomizationContext.Provider value={{
      accentColor,
      customAccentHex,
      tableDensity,
      layoutMode,
      cardStyle,
      fontSize,
      fontFamily,
      radiusSize,
      statusColors,
      setAccentColor: (v) => update('accent-color', v, setAccentColor),
      setCustomAccentHex: (v) => update('custom-accent-hex', v, setCustomAccentHex),
      setTableDensity: (v) => update('table-density', v, setTableDensity),
      setLayoutMode: (v) => update('layout-mode', v, setLayoutMode),
      setCardStyle: (v) => update('card-style', v, setCardStyle),
      setFontSize: (v) => update('font-size', v, setFontSize),
      setFontFamily: (v) => update('font-family', v, setFontFamily),
      setRadiusSize: (v) => update('radius-size', v, setRadiusSize),
      setStatusColor,
    }}>
      {children}
    </CustomizationContext.Provider>
  );
};

export const useCustomization = () => useContext(CustomizationContext);
