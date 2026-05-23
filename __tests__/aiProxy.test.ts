import { buildDeepSeekPrompt } from '@/services/aiProxy';

describe('AI Proxy', () => {
  describe('buildDeepSeekPrompt', () => {
    it('wraps input text in the analysis prompt', () => {
      const prompt = buildDeepSeekPrompt('下午3点开会');
      expect(prompt).toContain('下午3点开会');
      expect(prompt).toContain('todo|note');
      expect(prompt).toContain('ai_metadata');
    });
  });
});
