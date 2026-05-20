import { buildDeepSeekPrompt } from '@/services/aiProxy';

describe('AI Proxy', () => {
  describe('buildDeepSeekPrompt', () => {
    it('wraps input text in the analysis prompt', () => {
      const prompt = buildDeepSeekPrompt('花了32元买咖啡');
      expect(prompt).toContain('花了32元买咖啡');
      expect(prompt).toContain('expense|todo|note');
      expect(prompt).toContain('ai_metadata');
    });
  });
});
