import { describe, it, expect } from 'vitest';
import { stripHtml, escapeHtml, sanitizeString, sanitizeObject, sanitizeSensitiveField } from '../../utils/sanitize.js';

describe('sanitize utilities', () => {
  describe('stripHtml', () => {
    it('removes HTML tags', () => {
      expect(stripHtml('<script>alert("xss")</script>')).toBe('alert("xss")');
    });

    it('removes nested tags', () => {
      expect(stripHtml('<div><p>Hello</p></div>')).toBe('Hello');
    });

    it('preserves plain text', () => {
      expect(stripHtml('Hello World')).toBe('Hello World');
    });

    it('handles empty string', () => {
      expect(stripHtml('')).toBe('');
    });
  });

  describe('escapeHtml', () => {
    it('escapes special characters', () => {
      expect(escapeHtml('<script>"test" & \'more\'')).toBe('&lt;script&gt;&quot;test&quot; &amp; &#x27;more&#x27;');
    });
  });

  describe('sanitizeString', () => {
    it('strips HTML and trims', () => {
      expect(sanitizeString('  <b>Bold</b>  ')).toBe('Bold');
    });
  });

  describe('sanitizeObject', () => {
    it('sanitizes all string values recursively', () => {
      const input = {
        name: '<script>alert(1)</script>',
        nested: {
          value: '<img onerror="hack" src="x">',
        },
        number: 42,
        bool: true,
      };
      const result = sanitizeObject(input);
      expect(result.name).toBe('alert(1)');
      expect(result.nested.value).toBe('');
      expect(result.number).toBe(42);
      expect(result.bool).toBe(true);
    });

    it('handles empty objects', () => {
      expect(sanitizeObject({})).toEqual({});
    });

    it('preserves special chars in password fields', () => {
      const input = { password: 'my<?>pass!@#$%', name: '<b>Test</b>' };
      const result = sanitizeObject(input);
      expect(result.password).toBe('my<?>pass!@#$%'); // preserved
      expect(result.name).toBe('Test'); // stripped
    });

    it('preserves API key fields', () => {
      const input = { stripeSecretKey: 'sk_live_abc<123>', description: '<script>hack</script>' };
      const result = sanitizeObject(input);
      expect(result.stripeSecretKey).toBe('sk_live_abc<123>');
      expect(result.description).toBe('hack');
    });
  });

  describe('sanitizeSensitiveField', () => {
    it('preserves angle brackets in passwords', () => {
      expect(sanitizeSensitiveField('pass<?>word')).toBe('pass<?>word');
    });

    it('removes null bytes', () => {
      expect(sanitizeSensitiveField('pass\0word')).toBe('password');
    });

    it('removes BiDi override characters', () => {
      expect(sanitizeSensitiveField('pass\u202Eword')).toBe('password');
    });

    it('preserves normal special characters', () => {
      expect(sanitizeSensitiveField('P@$$w0rd!#%^&*()_+-=[]{}|;:\'",.<>?/~`')).toBe('P@$$w0rd!#%^&*()_+-=[]{}|;:\'",.<>?/~`');
    });
  });
});
