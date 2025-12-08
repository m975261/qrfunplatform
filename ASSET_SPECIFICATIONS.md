# QRFun UNO Game - Asset Specifications

This document provides all the information needed to generate custom game assets using Leonardo.ai (or any AI image generator) and integrate them into the game.

---

## Current Visual System

The game currently uses **CSS-based rendering** for cards and UI elements, NOT image files. This means:
- Cards are rendered with Tailwind CSS (colors, shadows, rounded corners)
- Avatars are generated with CSS gradients based on player nickname
- Background is a CSS gradient

To use custom AI-generated images, you'll need to replace specific files and update the code.

---

## Asset List with Specifications

### 1. Table Background
**Current Status:** CSS gradient only
**Purpose:** Main game board background where cards are played

| Property | Value |
|----------|-------|
| **File Name** | `table-background.jpg` or `table-background.png` |
| **File Path** | `attached_assets/generated/table-background.jpg` |
| **Dimensions** | 1920 x 1080 px (16:9 ratio) |
| **Format** | JPG (preferred for photos) or PNG |
| **Style** | Top-down view of gaming surface |

**Leonardo.ai Prompt:**
```
Premium casino poker table felt texture, rich dark green velvet surface, subtle elegant pattern, golden decorative border around edges, top-down aerial view, soft ambient lighting, professional game table for card games, high quality, no cards visible, clean centered composition
```

**Alternative Prompts:**
- Modern minimalist: `Minimalist dark blue gaming table surface, subtle gradient from center, soft glow effect, abstract geometric patterns, futuristic gaming aesthetic, clean design`
- Nintendo style: `Colorful cartoon game table, fun playful design, bright colors, Nintendo-inspired aesthetic, rounded corners, cheerful gaming atmosphere, illustration style`
- Pixel art: `Pixel art retro gaming table, 8-bit style, pixelated green felt texture, arcade game aesthetic, retro gaming vibes, nostalgic design`

---

### 2. Card Back Design
**Current Status:** Not implemented (cards are face-up or use placeholder)
**Purpose:** Shows when opponent cards are hidden

| Property | Value |
|----------|-------|
| **File Name** | `card-back.png` |
| **File Path** | `attached_assets/generated/card-back.png` |
| **Dimensions** | 256 x 384 px (2:3 ratio - standard card proportion) |
| **Format** | PNG with transparency |
| **Style** | Symmetrical design, no text |

**Leonardo.ai Prompt:**
```
UNO card back design, elegant swirl pattern, deep red and black colors, symmetrical ornate design, premium playing card back, no text, centered composition, high contrast, professional card game aesthetic, vector art style
```

**Alternative Prompts:**
- Colorful: `Rainbow spiral pattern card back, colorful UNO themed design, four quadrants in red blue green yellow, dynamic swirl effect, playing card back design, symmetrical, no text`
- Modern: `Modern geometric card back design, abstract shapes, gradient purple to blue, premium minimalist style, no text, symmetrical pattern`

---

### 3. Game Logo
**Current Status:** Text-based (CSS styled)
**Purpose:** App branding on home page and loading screens

| Property | Value |
|----------|-------|
| **File Name** | `logo.png` |
| **File Path** | `attached_assets/generated/logo.png` |
| **Dimensions** | 512 x 256 px (2:1 ratio) |
| **Format** | PNG with transparency |
| **Style** | Bold, colorful, playful |

**Leonardo.ai Prompt:**
```
QRFun game logo, colorful 3D letters, Nintendo Mario style, playful cartoon design, vibrant red blue green yellow colors, fun gaming aesthetic, white or transparent background, bold rounded typography, cheerful family-friendly design
```

---

### 4. UNO Logo/Title
**Current Status:** Emoji + text
**Purpose:** UNO game selection card on home page

| Property | Value |
|----------|-------|
| **File Name** | `uno-logo.png` |
| **File Path** | `attached_assets/generated/uno-logo.png` |
| **Dimensions** | 256 x 256 px (1:1 ratio) |
| **Format** | PNG with transparency |
| **Style** | Bold UNO branding |

**Leonardo.ai Prompt:**
```
UNO card game logo, bold red oval shape with white UNO text, classic card game branding, clean design, vibrant red color, white text, slight 3D effect, no background, iconic card game symbol
```

---

### 5. Player Avatar Backgrounds (Optional)
**Current Status:** CSS gradient circles with emoji
**Purpose:** Player identification around the game table

| Property | Value |
|----------|-------|
| **File Names** | `avatar-red.png`, `avatar-blue.png`, `avatar-green.png`, `avatar-yellow.png` |
| **File Path** | `attached_assets/generated/` |
| **Dimensions** | 128 x 128 px (1:1 ratio) |
| **Format** | PNG with transparency |
| **Style** | Circular, colorful |

**Leonardo.ai Prompt (for red):**
```
Circular game avatar frame, red gradient background, glowing border effect, cartoon style, perfect circle shape, gaming character portrait frame, no face, just decorative frame
```

---

### 6. Card Face Backgrounds (Optional - Advanced)
**Current Status:** Solid CSS colors
**Purpose:** Background texture for each card color

| Property | Value |
|----------|-------|
| **File Names** | `card-red.png`, `card-blue.png`, `card-green.png`, `card-yellow.png`, `card-wild.png` |
| **File Path** | `attached_assets/generated/` |
| **Dimensions** | 256 x 384 px (2:3 ratio) |
| **Format** | PNG |
| **Style** | Solid color with subtle texture |

**Leonardo.ai Prompt (for red):**
```
Solid red UNO card background, subtle paper texture, premium card material look, vibrant red color #DC2626, slight gradient darker at edges, no symbols or text, clean design for playing card
```

---

### 7. Action Card Icons (Optional - Advanced)
**Current Status:** CSS/SVG shapes
**Purpose:** Icons for Skip, Reverse, Draw Two, Wild, Wild Draw Four

| Property | Value |
|----------|-------|
| **File Names** | `icon-skip.png`, `icon-reverse.png`, `icon-draw2.png`, `icon-wild.png`, `icon-draw4.png` |
| **File Path** | `attached_assets/generated/` |
| **Dimensions** | 128 x 128 px (1:1 ratio) |
| **Format** | PNG with transparency |
| **Style** | Bold, clear icons |

**Leonardo.ai Prompt (for Skip):**
```
Skip symbol icon, circle with diagonal line through it, prohibition sign, bold black stroke, white fill, clean vector style, card game icon, no background, centered
```

---

## How to Integrate Assets

### Step 1: Generate and Save Assets
1. Generate images using Leonardo.ai with the prompts above
2. Download each image
3. Create the folder: `attached_assets/generated/`
4. Save files with exact names specified

### Step 2: Update Code to Use Assets

**For Table Background:**
Add this import to `client/src/pages/GameFixed.tsx` at the top:
```typescript
import tableBackground from '@assets/generated/table-background.jpg';
```

Then use it in the main container style:
```typescript
style={{ 
  backgroundImage: `url(${tableBackground})`,
  backgroundSize: 'cover',
  backgroundPosition: 'center'
}}
```

**For Card Back:**
Create new component or modify `client/src/components/game/Card.tsx`:
```typescript
import cardBack from '@assets/generated/card-back.png';

// Use for hidden cards
<img src={cardBack} alt="Card back" className="w-full h-full object-cover rounded-lg" />
```

**For Logo:**
Modify `client/src/pages/MainHome.tsx`:
```typescript
import logo from '@assets/generated/logo.png';

// Replace text logo with image
<img src={logo} alt="QRFun Games" className="h-16 w-auto" />
```

### Step 3: Restart Application
After adding assets and updating code, restart the application for changes to take effect.

---

## Color Reference

These are the exact UNO colors used in the game (for consistency):

| Color | CSS Variable | Hex Value | RGB |
|-------|-------------|-----------|-----|
| Red | `--uno-red` | #DC2626 | rgb(220, 38, 38) |
| Blue | `--uno-blue` | #2563EB | rgb(37, 99, 235) |
| Green | `--uno-green` | #16A34A | rgb(22, 163, 74) |
| Yellow | `--uno-yellow` | #EAB308 | rgb(234, 179, 8) |
| Black (Wild) | - | #000000 | rgb(0, 0, 0) |

---

## Recommended Generation Settings

For Leonardo.ai, use these settings:
- **Model:** Leonardo Kino XL or PhotoReal v2
- **Alchemy:** ON (for better quality)
- **PhotoReal:** ON for realistic assets, OFF for stylized/cartoon
- **Preset Style:** Based on your preference (Cinematic, Illustration, etc.)

---

## File Structure After Adding Assets

```
attached_assets/
├── generated/
│   ├── table-background.jpg    (1920x1080)
│   ├── card-back.png           (256x384)
│   ├── logo.png                (512x256)
│   ├── uno-logo.png            (256x256)
│   ├── avatar-red.png          (128x128, optional)
│   ├── avatar-blue.png         (128x128, optional)
│   ├── avatar-green.png        (128x128, optional)
│   ├── avatar-yellow.png       (128x128, optional)
│   ├── card-red.png            (256x384, optional)
│   ├── card-blue.png           (256x384, optional)
│   ├── card-green.png          (256x384, optional)
│   ├── card-yellow.png         (256x384, optional)
│   ├── card-wild.png           (256x384, optional)
│   ├── icon-skip.png           (128x128, optional)
│   ├── icon-reverse.png        (128x128, optional)
│   ├── icon-draw2.png          (128x128, optional)
│   ├── icon-wild.png           (128x128, optional)
│   └── icon-draw4.png          (128x128, optional)
```

---

## Priority Order (Recommended)

1. **Table Background** - Most visual impact
2. **Card Back** - Enhances opponent cards view
3. **Game Logo** - Branding improvement
4. **UNO Logo** - Game selection visual
5. **Card Backgrounds** - Complete visual overhaul (advanced)
6. **Action Icons** - Polish (advanced)
7. **Avatar Backgrounds** - Minor enhancement

---

## Notes

- All PNG files should have **transparent backgrounds** unless specified otherwise
- Use **high contrast** for clear visibility on different screens
- Test on both **desktop and mobile** after integration
- Keep file sizes reasonable (under 500KB per image for performance)
- The `@assets` import alias points to `attached_assets` folder
