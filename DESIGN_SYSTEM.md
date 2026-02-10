# Buddy Application - Global Design System

## Overview
This document outlines the global design system implemented for the Buddy Application. The design system ensures visual consistency, performance optimization, and maintainability across all pages **except Dashboard and Settings**, which maintain their unique layouts.

## Architecture

### File Structure
```
frontend/src/styles/
├── tokens.css        # Design tokens (colors, spacing, typography, etc.)
├── components.css    # Reusable component styles
├── layout.css        # Page layout and structure utilities
└── global.css        # Master stylesheet (imports all above)
```

### Import Order
The global design system is imported in `main.jsx` before any page-specific styles:
```javascript
import './styles/global.css'  // Global design system
import './index.css'          // Legacy/page-specific styles
```

## Design Tokens

### Color Palette
- **Primary**: `--primary-500` (#3b82f6) - Main brand color
- **Success**: `--success-color` (#10b981)
- **Danger**: `--danger-color` (#ef4444)
- **Warning**: `--warning-color` (#f59e0b)
- **Info**: `--info-color` (#3b82f6)

### Backgrounds
- `--bg-primary`: #0f172a (Main background)
- `--bg-secondary`: #1e293b (Secondary background)
- `--card-bg`: rgba(30, 41, 59, 0.8) (Card backgrounds)

### Text Colors
- `--text-main`: #ffffff (Primary text)
- `--text-sub`: #94a3b8 (Secondary text)
- `--text-muted`: rgba(255, 255, 255, 0.4) (Muted text)

### Spacing Scale
```css
--space-1: 4px
--space-2: 8px
--space-3: 12px
--space-4: 16px
--space-6: 24px
--space-8: 32px
--space-12: 48px
```

### Border Radius
```css
--radius-sm: 6px
--radius-md: 8px
--radius-lg: 12px
--radius-xl: 16px
--radius-2xl: 20px
--radius-3xl: 24px
```

### Typography
- **Font Family**: Inter, system fonts
- **Sizes**: `--text-xs` (12px) to `--text-4xl` (36px)
- **Weights**: `--font-normal` (400) to `--font-extrabold` (800)

## Component Library

### Buttons
```html
<!-- Primary Button -->
<button class="btn btn-primary">Click Me</button>

<!-- Secondary Button -->
<button class="btn btn-secondary">Cancel</button>

<!-- Danger Button -->
<button class="btn btn-danger">Delete</button>

<!-- Sizes -->
<button class="btn btn-primary btn-sm">Small</button>
<button class="btn btn-primary btn-md">Medium</button>
<button class="btn btn-primary btn-lg">Large</button>

<!-- Icon Button -->
<button class="btn btn-icon btn-primary">
    <Icon />
</button>
```

### Inputs
```html
<!-- Standard Input -->
<input type="text" class="input" placeholder="Enter text..." />

<!-- Input with Icon -->
<div class="input-wrapper">
    <SearchIcon class="input-icon" />
    <input type="text" class="input" placeholder="Search..." />
</div>

<!-- Sizes -->
<input type="text" class="input input-sm" />
<input type="text" class="input input-md" />
<input type="text" class="input input-lg" />

<!-- Error State -->
<input type="text" class="input input-error" />
```

### Cards
```html
<div class="card">
    <div class="card-header">
        <h3 class="card-title">Card Title</h3>
        <button class="btn btn-sm">Action</button>
    </div>
    <div class="card-body">
        Card content goes here
    </div>
    <div class="card-footer">
        Footer content
    </div>
</div>
```

### Modals
```html
<div class="modal-backdrop">
    <div class="modal">
        <div class="modal-header">
            <h3 class="modal-title">Modal Title</h3>
            <button class="modal-close">×</button>
        </div>
        <div class="modal-body">
            Modal content
        </div>
        <div class="modal-footer">
            <button class="btn btn-secondary">Cancel</button>
            <button class="btn btn-primary">Confirm</button>
        </div>
    </div>
</div>
```

### Tables
```html
<div class="table-container">
    <div class="table-wrapper">
        <table class="table">
            <thead>
                <tr>
                    <th>Column 1</th>
                    <th>Column 2</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td>Data 1</td>
                    <td>Data 2</td>
                </tr>
            </tbody>
        </table>
    </div>
</div>
```

### Badges
```html
<span class="badge badge-primary">Primary</span>
<span class="badge badge-success">Success</span>
<span class="badge badge-danger">Danger</span>
<span class="badge badge-warning">Warning</span>
```

## Layout System

### Page Structure
```html
<div class="page-container">
    <div class="page-content">
        <div class="page-header">
            <h1 class="page-title">Page Title</h1>
            <p class="page-subtitle">Page description</p>
        </div>
        
        <!-- Page content -->
    </div>
</div>
```

### Grid Layouts
```html
<div class="grid grid-cols-3 gap-6">
    <div>Column 1</div>
    <div>Column 2</div>
    <div>Column 3</div>
</div>
```

### Search Bar
```html
<div class="search-bar">
    <div class="search-input-wrapper">
        <SearchIcon class="search-icon" />
        <input type="text" class="search-input" placeholder="Search..." />
    </div>
    <button class="btn btn-primary">New Item</button>
</div>
```

### Action Bar
```html
<div class="action-bar">
    <div class="action-group">
        <button class="btn btn-primary">Action 1</button>
        <button class="btn btn-secondary">Action 2</button>
    </div>
    <div class="action-group">
        <button class="btn btn-outline">Filter</button>
    </div>
</div>
```

## Performance Optimizations

### Image Lazy Loading
```html
<img src="image.jpg" loading="lazy" alt="Description" />
```

### Content Visibility
```html
<section class="lazy-section">
    <!-- Large content that can be lazy-loaded -->
</section>
```

### GPU Acceleration
```html
<div class="gpu-accelerated">
    <!-- Animated content -->
</div>
```

## Responsive Design

### Breakpoints
- **Mobile**: < 768px
- **Tablet**: 768px - 1024px
- **Desktop**: > 1024px

### Responsive Utilities
```html
<!-- Hide on mobile -->
<div class="hide-mobile">Desktop only</div>

<!-- Hide on compact screens -->
<div class="hide-compact">Tablet and desktop only</div>
```

### Responsive Grid
```html
<!-- 4 columns on desktop, 2 on tablet, 1 on mobile -->
<div class="grid grid-cols-4">
    <!-- Grid items -->
</div>
```

## Accessibility

### Screen Reader Only
```html
<span class="sr-only">Screen reader text</span>
```

### Skip Link
```html
<a href="#main-content" class="skip-link">Skip to main content</a>
```

### Focus Styles
All interactive elements automatically receive focus styles using `:focus-visible`.

## Utility Classes

### Flexbox
```html
<div class="flex items-center justify-between gap-4">
    <div>Left</div>
    <div>Right</div>
</div>
```

### Spacing
```html
<div class="mb-6">Margin bottom 24px</div>
<div class="mt-4">Margin top 16px</div>
```

### Text Alignment
```html
<div class="text-center">Centered text</div>
<div class="text-right">Right-aligned text</div>
```

### Text Colors
```html
<p class="text-muted">Muted text</p>
<p class="text-danger">Danger text</p>
<p class="text-success">Success text</p>
```

## Exceptions

### Dashboard Page
The Dashboard page maintains its unique layout and styling. It does NOT use the global component classes but benefits from:
- Performance optimizations
- Design tokens (colors, spacing)
- Accessibility features

### Settings Pages
Both AdminSettings and UserSettings maintain their unique layouts. They do NOT use the global component classes but benefit from:
- Performance optimizations
- Design tokens
- Accessibility features

## Migration Guide

### Converting Existing Pages

1. **Replace inline styles with classes:**
```javascript
// Before
<button style={{ padding: '12px 24px', background: '#3b82f6' }}>
    Click Me
</button>

// After
<button className="btn btn-primary">
    Click Me
</button>
```

2. **Use design tokens for custom styles:**
```javascript
// Before
<div style={{ padding: '24px', borderRadius: '16px' }}>

// After
<div style={{ padding: 'var(--space-6)', borderRadius: 'var(--radius-xl)' }}>
```

3. **Replace custom modals with global modal:**
```javascript
// Use the modal classes instead of custom styled components
<div className="modal-backdrop">
    <div className="modal">
        {/* Modal content */}
    </div>
</div>
```

## Best Practices

1. **Always use design tokens** instead of hardcoded values
2. **Prefer global classes** over inline styles
3. **Use semantic HTML** elements
4. **Ensure responsive behavior** with utility classes
5. **Test accessibility** with keyboard navigation
6. **Optimize images** with lazy loading
7. **Use CSS variables** for dynamic theming

## Browser Support

- Chrome/Edge: Latest 2 versions
- Firefox: Latest 2 versions
- Safari: Latest 2 versions
- Mobile browsers: iOS Safari, Chrome Android

## Future Enhancements

- [ ] Dark/Light mode toggle
- [ ] Custom theme builder
- [ ] Component playground
- [ ] Storybook integration
- [ ] Automated visual regression testing

## Support

For questions or issues with the design system, please contact the development team or create an issue in the project repository.
