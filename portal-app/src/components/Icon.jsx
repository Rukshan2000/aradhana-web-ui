/**
 * Font Awesome, wrapped so a glyph is never announced to a screen reader as
 * mystery text: the icon itself is always aria-hidden, and an icon-only
 * control carries its meaning in the button's own title/aria-label instead.
 *
 * The free solid + regular + brands CSS is imported once in main.jsx; the
 * fonts ship with the app rather than coming from a CDN, so the portal keeps
 * working on a venue's flaky wifi.
 */
export default function Icon({ name, style = 'solid', className = '', fixedWidth = false }) {
  return (
    <i
      className={`fa-${style} fa-${name}${fixedWidth ? ' fa-fw' : ''}${className ? ` ${className}` : ''}`}
      aria-hidden="true"
    />
  );
}
