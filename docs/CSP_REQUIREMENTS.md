# Content Security Policy (CSP) Requirements

## Overview

The Devign extension webview uses a strict Content Security Policy to prevent XSS attacks and ensure security.

## Current CSP Configuration

```
default-src 'none';
style-src ${webview.cspSource};
font-src ${webview.cspSource};
img-src ${webview.cspSource} data:;
script-src 'nonce-${nonce}';
connect-src 'none';
frame-src 'none';
object-src 'none';
base-uri 'none';
form-action 'none';
```

## Directive Explanations

| Directive | Value | Purpose |
|-----------|-------|---------|
| `default-src` | `'none'` | Block all resources by default |
| `style-src` | `${webview.cspSource}` | Allow styles only from extension resources |
| `font-src` | `${webview.cspSource}` | Allow fonts (codicons) from extension resources |
| `img-src` | `${webview.cspSource} data:` | Allow images from extension and data URIs |
| `script-src` | `'nonce-${nonce}'` | Allow scripts only with valid nonce |
| `connect-src` | `'none'` | Block all network requests (fetch, XHR) |
| `frame-src` | `'none'` | Block all iframes |
| `object-src` | `'none'` | Block plugins (Flash, Java, etc.) |
| `base-uri` | `'none'` | Prevent base tag injection |
| `form-action` | `'none'` | Prevent form submissions |

## Security Best Practices

### DO:
- Use nonce-based script loading
- Load all resources from extension bundle
- Sanitize any user-provided content before display
- Use VS Code's webview API for communication

### DON'T:
- Use inline styles with `style` attribute (use CSS classes instead)
- Load external resources (CDNs, remote URLs)
- Use `eval()` or `new Function()`
- Trust user input without sanitization

## HTML Sanitization

When displaying vulnerability findings that may contain user code:

```typescript
// Use text content instead of innerHTML
element.textContent = userProvidedCode;

// Or use a sanitization library for rich content
import DOMPurify from 'dompurify';
const clean = DOMPurify.sanitize(dirtyHtml);
```

## Testing CSP

1. Open DevTools in the webview (Help > Toggle Developer Tools)
2. Check Console for CSP violation errors
3. Verify no external resources are loaded in Network tab

## Updating CSP

When adding new features that require CSP changes:

1. Document the reason for the change
2. Use the most restrictive directive possible
3. Test thoroughly for CSP violations
4. Update this documentation
