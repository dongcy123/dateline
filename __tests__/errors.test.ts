import { getUserError, toAPIError } from '@/lib/errors';

describe('Error system', () => {
  describe('getUserError', () => {
    it('returns Chinese error for network_error', () => {
      const err = getUserError('network_error');
      expect(err.problem).toContain('网络');
      expect(err.action).toBe('重试');
    });

    it('returns unknown error for unmapped codes', () => {
      const err = getUserError('nonexistent');
      expect(err.problem).toContain('意外');
    });
  });

  describe('toAPIError', () => {
    it('detects network errors', () => {
      const err = toAPIError(new Error('fetch failed'));
      expect(err.code).toBe('network_error');
    });

    it('detects auth errors', () => {
      const err = toAPIError(new Error('401 Unauthorized'));
      expect(err.code).toBe('api_key_invalid');
    });

    it('detects rate limit errors', () => {
      const err = toAPIError(new Error('429 Too Many Requests'));
      expect(err.code).toBe('rate_limit');
    });
  });
});
