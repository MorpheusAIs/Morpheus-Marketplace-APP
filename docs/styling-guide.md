# Styling Guide

## Color Palette

### Primary Colors

#### Green (Primary Actions)
- **Primary Green**: `bg-green-500` / `text-green-500`
- **Hover State**: `hover:bg-green-600`
- **Usage**: Primary buttons, links, success states, selected items, verified status indicators

#### Purple (Chat & Account)
- **Account Purple**: `#FD67C4` (custom pink/purple)
  - Use as: `bg-[#FD67C4]` or `text-[#FD67C4]`
  - Usage: Account-related UI elements, accent colors
- **Chat Bubble Purple**: `bg-purple-800` / `text-purple-800`
  - Usage: User message bubbles in chat interface
- **Chat Send Button**: `bg-purple-600` / `hover:bg-purple-700`
  - Usage: Send button in chat input area

#### Red (Warnings & Destructive Actions)
- **Red Warning**: `text-red-500` / `bg-red-500`
- **Hover State**: `hover:bg-red-600` / `hover:bg-red-700`
- **Destructive Button**: `variant="destructive"` (Shadcn default red)
- **Warning Background**: `bg-red-900/20` (20% opacity)
- **Warning Border**: `border-red-500`
- **Usage**: Delete actions, warnings, error states, destructive confirmations

### Theme Colors

#### Background Colors
- **Main Background**: `bg-background` (dark theme)
- **Card Background**: `bg-card` / `bg-gray-800`
- **Input Background**: `bg-input`
- **Sidebar Background**: `bg-gray-900`
- **Chat Area Background**: `bg-gray-950`

#### Text Colors
- **Primary Text**: `text-foreground` / `text-white`
- **Secondary Text**: `text-muted-foreground` / `text-gray-400`
- **Tertiary Text**: `text-gray-500`

#### Border Colors
- **Default Border**: `border-border` / `border-gray-800`
- **Input Border**: `border-input` / `border-gray-700`

## Component-Specific Styling

### Buttons

#### Primary Button (Green)
```tsx
className="bg-green-500 hover:bg-green-600 text-white"
```

#### Secondary Button (Outline)
```tsx
variant="outline"
className="text-white border-gray-700 hover:bg-gray-700"
```

#### Destructive Button (Red)
```tsx
variant="destructive"
className="bg-red-600 hover:bg-red-700 text-white"
```

#### Ghost Button
```tsx
variant="ghost"
className="hover:bg-gray-700"
```

### Cards
```tsx
className="bg-card text-card-foreground rounded-lg shadow-lg border border-border"
```

### Input Fields
```tsx
className="bg-input border-border text-foreground placeholder:text-muted-foreground"
```

### Chat Bubbles

#### User Message
```tsx
className="bg-purple-800 rounded-lg p-3 max-w-[70%] ml-auto"
```

#### Assistant Message
```tsx
className="bg-gray-800 rounded-lg p-3 max-w-[70%] mr-auto"
```

### Status Indicators

#### Success/Verified (Green)
```tsx
className="bg-green-500/20 text-green-500"
// or
className="bg-green-500 text-white"
```

#### Warning (Red)
```tsx
className="bg-red-900/20 border border-red-500 text-red-500"
```

### Badges

#### Default Badge (Green)
```tsx
className="bg-green-600 text-white"
```

#### Status Badge
```tsx
className="bg-green-500/20 text-green-500"
```

## Typography

### Headings
- **H1**: `text-4xl font-bold text-white`
- **H2**: `text-2xl font-semibold text-white`
- **H3**: `text-xl font-semibold`

### Body Text
- **Primary**: `text-foreground` / `text-white`
- **Secondary**: `text-muted-foreground` / `text-gray-400`
- **Small**: `text-sm text-gray-400`
- **Monospace**: `font-mono text-sm` (for API keys, code)

## Spacing

### Common Patterns
- **Card Padding**: `p-6`
- **Section Spacing**: `mt-8` / `space-y-6`
- **Form Field Spacing**: `space-y-2`
- **Button Spacing**: `gap-2` / `space-x-2`

## Border Radius

- **Cards**: `rounded-lg`
- **Buttons**: `rounded-md`
- **Inputs**: Default (usually `rounded-md`)
- **Badges**: Default (usually `rounded-full`)

## Shadows

- **Cards**: `shadow-lg`
- **Modals**: `shadow-lg` or `shadow-xl`

## Dark Theme Variables

All components use Shadcn UI dark theme variables:
- `bg-background` - Main background
- `bg-card` - Card background
- `bg-input` - Input background
- `text-foreground` - Primary text
- `text-muted-foreground` - Secondary text
- `border-border` - Default borders

## Responsive Design

- **Mobile**: Default styles
- **Tablet**: `sm:` prefix (640px+)
- **Desktop**: `md:` prefix (768px+)
- **Large Desktop**: `lg:` prefix (1024px+)

## Accessibility

- All interactive elements have hover states
- Focus states use ring utilities: `focus-visible:ring-ring`
- Color contrast meets WCAG AA standards
- Semantic HTML elements used throughout

