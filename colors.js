import { createClient } from '@supabase/supabase-js';
import ColorThief from 'colorthief';

const DEFAULT_COLORS = {
  bgPrimary: '#e8d5f2',
  bgSecondary: '#d4b5e0',
  textPrimary: '#9d5dd4',
  textSecondary: '#9d5dd4'
};

const PROFILE_ID = 'lilminy';

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

function rgbToHex(r, g, b) {
  return '#' + [r, g, b].map(x => {
    const hex = x.toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  }).join('').toUpperCase();
}

function setRootColors(colors) {
  const root = document.documentElement;
  root.style.setProperty('--bg-primary', colors.bgPrimary);
  root.style.setProperty('--bg-secondary', colors.bgSecondary);
  root.style.setProperty('--text-primary', colors.textPrimary);
  root.style.setProperty('--text-secondary', colors.textSecondary);

  document.body.style.background = `linear-gradient(135deg, ${colors.bgPrimary} 0%, ${colors.bgSecondary} 100%)`;
}

async function extractColorsFromImage(imageUrl) {
  try {
    const img = new Image();
    img.crossOrigin = 'anonymous';

    return new Promise((resolve, reject) => {
      img.onload = async () => {
        try {
          const colorThief = new ColorThief();
          const palette = colorThief.getPalette(img, 4);

          if (!palette || palette.length < 2) {
            reject(new Error('Insufficient colors extracted'));
            return;
          }

          const colors = {
            bgPrimary: rgbToHex(...palette[0]),
            bgSecondary: rgbToHex(...palette[1]),
            textPrimary: rgbToHex(...(palette[2] || palette[0])),
            textSecondary: rgbToHex(...(palette[3] || palette[0]))
          };

          resolve(colors);
        } catch (error) {
          reject(error);
        }
      };

      img.onerror = () => {
        reject(new Error('Failed to load image'));
      };

      img.src = imageUrl;
    });
  } catch (error) {
    console.error('Color extraction failed:', error);
    throw error;
  }
}

async function loadColorsFromSupabase() {
  try {
    const { data, error } = await supabase
      .from('color_palettes')
      .select('*')
      .eq('profile_id', PROFILE_ID)
      .maybeSingle();

    if (error) {
      console.error('Supabase fetch error:', error);
      return null;
    }

    if (data) {
      return {
        bgPrimary: data.bg_primary,
        bgSecondary: data.bg_secondary,
        textPrimary: data.text_primary,
        textSecondary: data.text_secondary
      };
    }

    return null;
  } catch (error) {
    console.error('Failed to load colors from Supabase:', error);
    return null;
  }
}

async function saveColorsToSupabase(colors) {
  try {
    const { error } = await supabase
      .from('color_palettes')
      .upsert({
        profile_id: PROFILE_ID,
        bg_primary: colors.bgPrimary,
        bg_secondary: colors.bgSecondary,
        text_primary: colors.textPrimary,
        text_secondary: colors.textSecondary,
        updated_at: new Date().toISOString()
      });

    if (error) {
      console.error('Failed to save colors to Supabase:', error);
    }
  } catch (error) {
    console.error('Error saving colors:', error);
  }
}

export async function initializeColors() {
  try {
    const cachedColors = await loadColorsFromSupabase();

    if (cachedColors) {
      setRootColors(cachedColors);
      return;
    }

    const profileImage = document.querySelector('.profile-image');
    if (!profileImage) {
      setRootColors(DEFAULT_COLORS);
      return;
    }

    if (profileImage.complete) {
      const imageUrl = profileImage.src;
      const extractedColors = await extractColorsFromImage(imageUrl);
      setRootColors(extractedColors);
      await saveColorsToSupabase(extractedColors);
    } else {
      profileImage.addEventListener('load', async () => {
        const imageUrl = profileImage.src;
        const extractedColors = await extractColorsFromImage(imageUrl);
        setRootColors(extractedColors);
        await saveColorsToSupabase(extractedColors);
      });

      profileImage.addEventListener('error', () => {
        setRootColors(DEFAULT_COLORS);
      });
    }
  } catch (error) {
    console.error('Color initialization error:', error);
    setRootColors(DEFAULT_COLORS);
  }
}
