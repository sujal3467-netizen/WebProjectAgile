# SS-63 — ShiftSwap Design Style Guide

## Purpose

This style guide defines the shared visual design for ShiftSwap, based on the Figma design system created for the Sprint 2 design refresh.

The goal is to make the employee and manager interfaces consistent, modern, responsive, and easy to use.

## 1. Colour Palette

| Colour | Hex | Usage |
|---|---|---|
| Primary Blue | `#2563EB` | Main buttons, links, navigation |
| Primary Dark | `#1D4ED8` | Hover states |
| Success Green | `#15803D` | Successful actions and approvals |
| Warning Amber | `#B45309` | Warnings and pending actions |
| Error Red | `#B91C1C` | Rejections and destructive actions |
| Background | `#F8FAFC` | Page backgrounds |
| Surface | `#FFFFFF` | Cards and form surfaces |
| Main Text | `#0F172A` | Headings and body text |
| Muted Text | `#64748B` | Supporting text |
| Border | `#E2E8F0` | Dividers and input borders |

## 2. Typography

- Font family: Segoe UI, Arial, sans-serif
- Main heading: 32px, bold
- Section heading: 24px, bold
- Subheading: 20px, semibold
- Body text: 16px, regular
- Caption: 12px, regular

## 3. Spacing

Use the following spacing scale:

- 4px — extra-small
- 8px — small
- 16px — medium
- 24px — large
- 32px — extra-large

## 4. Corner Radius

- Buttons and form inputs: 8px
- Cards and panels: 12px
- Status badges: fully rounded

## 5. Buttons

- Primary: Blue background with white text
- Secondary: White background with blue text and border
- Danger: Red background with white text
- Success: Green background with white text
- Minimum standard button height: 44px

Buttons must provide visible hover, focus, and disabled states.

## 6. Cards and Layout

Cards use white backgrounds, subtle shadows, rounded corners, and consistent padding.

Layouts should adapt to desktop, tablet, and mobile screen sizes.

## 7. Icons

Use consistent icon sizes and styles throughout the application. Icons should support navigation and actions, with text labels where needed for clarity.

## 8. Implementation

The shared design system is implemented in:

`www/css/style.css`

Manager-specific styles are implemented in:

`www/manager/manager.css`

Manager styles should reuse the shared CSS variables wherever possible.

## 9. Design Reference

Figma: ShiftSwap Design System — colour palette, typography, spacing, corner radius, and button components.

Jira ticket: SS-63 — Design refresh: new style guide and style.css.
