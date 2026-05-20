/** Stripe-style structured error for API responses */
export interface APIError {
  type: 'api_error' | 'invalid_request' | 'rate_limit' | 'model_unavailable' | 'parse_error' | 'network_error';
  code: string;
  message: string;
  param?: string;
  doc_url?: string;
}

/** Elm-style user-facing error with Chinese messages and suggested actions */
export interface UserError {
  /** Conversational Chinese description of what happened */
  problem: string;
  /** Why it happened, in plain language */
  cause: string;
  /** Suggested fix action */
  fix: string;
  /** Optional action button label */
  action?: string;
}

const ERROR_MAP: Record<string, UserError> = {
  network_error: {
    problem: '网络连接失败了',
    cause: '无法连接到 AI 服务，可能是网络不稳定或防火墙限制',
    fix: '请检查网络连接后点击重试',
    action: '重试',
  },
  api_key_invalid: {
    problem: 'API 密钥无效',
    cause: '当前使用的 API 密钥未通过验证，可能已过期或被撤销',
    fix: '请在 .env 文件中更新有效的 API 密钥',
    action: '查看设置',
  },
  rate_limit: {
    problem: '请求太频繁了，请稍等片刻',
    cause: '短时间内发起了过多 AI 请求，触发了频率限制',
    fix: '请等待几秒后再试',
    action: '知道了',
  },
  model_unavailable: {
    problem: 'AI 模型暂时不可用',
    cause: '当前模型正在维护中或已下线',
    fix: '系统将自动切换到备用模型，请稍后再试',
    action: '重试',
  },
  parse_error: {
    problem: 'AI 返回的数据格式异常',
    cause: 'AI 模型返回了无法识别的内容，可能是输入过于模糊',
    fix: '请用更具体的语言重新描述',
    action: '重新输入',
  },
  unknown: {
    problem: '出了点意外状况',
    cause: '遇到了未知错误',
    fix: '请稍后重试，如果问题持续请提交 Issue',
    action: '重试',
  },
};

export function getUserError(code: string): UserError {
  return ERROR_MAP[code] || ERROR_MAP.unknown;
}

export function toAPIError(err: unknown): APIError {
  if (err instanceof Error) {
    if (err.message.includes('fetch') || err.message.includes('network')) {
      return { type: 'network_error', code: 'network_error', message: err.message };
    }
    if (err.message.includes('401') || err.message.includes('403')) {
      return { type: 'api_error', code: 'api_key_invalid', message: err.message };
    }
    if (err.message.includes('429')) {
      return { type: 'rate_limit', code: 'rate_limit', message: err.message };
    }
  }
  return { type: 'api_error', code: 'unknown', message: 'An unexpected error occurred' };
}
