#!/bin/bash
# ================================================
# TimelineOS — Deploy AI Proxy Edge Function
# 使用方法:
#   1. npx supabase login (仅首次)
#   2. npx supabase link --project-ref gduqrtzoggpjyifxvzxy (仅首次)
#   3. bash supabase/functions/deploy.sh
# ================================================
set -e

# Load env vars from .env
set -a
source .env
set +a

echo "==> Setting secrets..."
npx supabase secrets set DEEPSEEK_API_KEY="$DEEPSEEK_API_KEY" 2>/dev/null || echo "  (may already be set)"
npx supabase secrets set VISION_API_KEY="$VISION_API_KEY" 2>/dev/null || echo "  (may already be set)"
npx supabase secrets set VISION_BASE_URL="$VISION_BASE_URL" 2>/dev/null || echo "  (may already be set)"
npx supabase secrets set VISION_MODEL="$VISION_MODEL" 2>/dev/null || echo "  (may already be set)"
npx supabase secrets set AI_PROXY_DEBUG=true 2>/dev/null || echo "  (may already be set)"

echo "==> Deploying ai-proxy function..."
npx supabase functions deploy ai-proxy --no-verify-jwt

echo ""
echo "Deploy complete!"
echo "Endpoint: https://gduqrtzoggpjyifxvzxy.supabase.co/functions/v1/ai-proxy"
echo ""
echo "Test it:"
echo "  curl -X POST https://gduqrtzoggpjyifxvzxy.supabase.co/functions/v1/ai-proxy \\"
echo "    -H 'Content-Type: application/json' \\"
echo "    -d '{\"text\":\"花了32元买咖啡\"}'"
