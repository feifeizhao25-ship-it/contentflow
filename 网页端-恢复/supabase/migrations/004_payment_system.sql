-- ==================== 支付与订阅系统 ====================

-- 用户订阅表
CREATE TABLE IF NOT EXISTS user_subscriptions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    plan TEXT NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'pro', 'enterprise')),
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'cancelled', 'expired')),
    monthly_quota INTEGER NOT NULL DEFAULT 20,
    used_quota INTEGER NOT NULL DEFAULT 0,
    storage_limit BIGINT NOT NULL DEFAULT 1073741824, -- 1GB
    started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    auto_renew BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    UNIQUE(user_id)
);

-- 支付记录表
CREATE TABLE IF NOT EXISTS payment_records (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    amount DECIMAL(10, 2) NOT NULL,
    currency TEXT NOT NULL DEFAULT 'CNY',
    payment_method TEXT NOT NULL DEFAULT 'online',
    transaction_id TEXT NOT NULL UNIQUE,
    plan_type TEXT NOT NULL DEFAULT 'free' CHECK (plan_type IN ('free', 'pro', 'enterprise')),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed', 'refunded')),
    credits_granted INTEGER,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- 积分交易表
CREATE TABLE IF NOT EXISTS points_transactions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    amount INTEGER NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('earn', 'spend')),
    reason TEXT NOT NULL,
    related_id TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- 素材表
CREATE TABLE IF NOT EXISTS materials (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    url TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('image', 'video')),
    file_size BIGINT,
    mime_type TEXT,
    tags TEXT[] DEFAULT '{}',
    is_favorite BOOLEAN NOT NULL DEFAULT false,
    storage_path TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_user_id ON user_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_payment_records_user_id ON payment_records(user_id);
CREATE INDEX IF NOT EXISTS idx_payment_records_transaction_id ON payment_records(transaction_id);
CREATE INDEX IF NOT EXISTS idx_points_transactions_user_id ON points_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_materials_user_id ON materials(user_id);
CREATE INDEX IF NOT EXISTS idx_materials_type ON materials(type);
CREATE INDEX IF NOT EXISTS idx_materials_created_at ON materials(created_at DESC);

-- RLS 策略
ALTER TABLE user_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE points_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE materials ENABLE ROW LEVEL SECURITY;

-- 用户只能查看自己的数据
CREATE POLICY "Users can view own subscription" ON user_subscriptions
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can view own payments" ON payment_records
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can view own points transactions" ON points_transactions
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own materials" ON materials
    FOR ALL USING (auth.uid() = user_id);

-- 存储桶策略（Supabase Storage）
-- materials 存储桶的策略需要在 Supabase 控制台配置
