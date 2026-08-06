-- 分发侠 (ContentFlow) 数据库架构
-- 多租户SaaS平台数据模型

-- 启用UUID扩展
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- 租户表 (Tenants)
-- ============================================
CREATE TABLE tenants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    plan VARCHAR(20) DEFAULT 'free' CHECK (plan IN ('free', 'pro', 'team', 'enterprise')),
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),
    limits JSONB DEFAULT '{
        "accounts": 2,
        "members": 1,
        "monthly_posts": 30,
        "ai_generations": 20,
        "storage_gb": 1
    }'::jsonb,
    settings JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- 用户/成员表 (Profiles)
-- ============================================
CREATE TABLE profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(100),
    avatar_url VARCHAR(500),
    role VARCHAR(20) DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'editor', 'viewer')),
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- 平台账号表 (Platform Accounts)
-- ============================================
CREATE TABLE platform_accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    platform VARCHAR(50) NOT NULL CHECK (platform IN (
        'douyin', 'xiaohongshu', 'weixin', 'weixin_mp', 
        'weibo', 'bilibili', 'zhihu', 'kuaishou', 'toutiao', 'baijiahao'
    )),
    account_name VARCHAR(200),
    account_id VARCHAR(100),
    avatar_url VARCHAR(500),
    follower_count INTEGER DEFAULT 0,
    auth_type VARCHAR(20) CHECK (auth_type IN ('oauth', 'cookie', 'token')),
    auth_data JSONB, -- 加密存储授权信息
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'expired', 'error')),
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- 内容表 (Contents)
-- ============================================
CREATE TABLE contents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    content_type VARCHAR(20) CHECK (content_type IN ('article', 'video', 'image')),
    title VARCHAR(500) NOT NULL,
    body TEXT,
    media_urls JSONB DEFAULT '[]'::jsonb,
    tags JSONB DEFAULT '[]'::jsonb,
    status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'pending', 'approved', 'rejected', 'published')),
    source VARCHAR(20) DEFAULT 'manual' CHECK (source IN ('manual', 'ai_generated')),
    ai_params JSONB, -- AI生成参数
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- 平台内容适配表 (Platform Contents)
-- ============================================
CREATE TABLE platform_contents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    content_id UUID REFERENCES contents(id) ON DELETE CASCADE,
    platform VARCHAR(50) NOT NULL,
    title VARCHAR(500),
    body TEXT,
    hashtags JSONB DEFAULT '[]'::jsonb,
    cover_url VARCHAR(500),
    media_urls JSONB DEFAULT '[]'::jsonb,
    extra_data JSONB DEFAULT '{}'::jsonb, -- 平台特殊字段
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- 发布任务表 (Publish Tasks)
-- ============================================
CREATE TABLE publish_tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    content_id UUID REFERENCES contents(id) ON DELETE CASCADE,
    platform_account_id UUID REFERENCES platform_accounts(id) ON DELETE CASCADE,
    platform_content_id UUID REFERENCES platform_contents(id) ON DELETE SET NULL,
    scheduled_at TIMESTAMP WITH TIME ZONE,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'publishing', 'success', 'failed')),
    result JSONB, -- 发布结果
    post_id VARCHAR(100), -- 平台返回的内容ID
    post_url VARCHAR(500),
    retry_count INTEGER DEFAULT 0,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    published_at TIMESTAMP WITH TIME ZONE
);

-- ============================================
-- 数据统计表 (Content Stats)
-- ============================================
CREATE TABLE content_stats (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    publish_task_id UUID REFERENCES publish_tasks(id) ON DELETE CASCADE,
    views INTEGER DEFAULT 0,
    likes INTEGER DEFAULT 0,
    comments INTEGER DEFAULT 0,
    shares INTEGER DEFAULT 0,
    saves INTEGER DEFAULT 0,
    followers_gained INTEGER DEFAULT 0,
    stat_time TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- 审核记录表 (Review Logs)
-- ============================================
CREATE TABLE review_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    content_id UUID REFERENCES contents(id) ON DELETE CASCADE,
    reviewer_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    action VARCHAR(20) CHECK (action IN ('approve', 'reject', 'request_change')),
    comment TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- 订阅/支付表 (Subscriptions)
-- ============================================
CREATE TABLE subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    plan VARCHAR(20) NOT NULL,
    status VARCHAR(20) CHECK (status IN ('active', 'cancelled', 'expired')),
    amount DECIMAL(10,2),
    billing_cycle VARCHAR(20) CHECK (billing_cycle IN ('monthly', 'yearly')),
    current_period_start TIMESTAMP WITH TIME ZONE,
    current_period_end TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- 用量记录表 (Usage Logs)
-- ============================================
CREATE TABLE usage_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    usage_type VARCHAR(50) NOT NULL,
    usage_count INTEGER DEFAULT 1,
    usage_date DATE DEFAULT CURRENT_DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- 索引
-- ============================================
CREATE INDEX idx_profiles_tenant_id ON profiles(tenant_id);
CREATE INDEX idx_platform_accounts_tenant_id ON platform_accounts(tenant_id);
CREATE INDEX idx_contents_tenant_id ON contents(tenant_id);
CREATE INDEX idx_contents_status ON contents(status);
CREATE INDEX idx_publish_tasks_tenant_id ON publish_tasks(tenant_id);
CREATE INDEX idx_publish_tasks_status ON publish_tasks(status);
CREATE INDEX idx_publish_tasks_scheduled_at ON publish_tasks(scheduled_at);
CREATE INDEX idx_usage_logs_tenant_id ON usage_logs(tenant_id);
CREATE INDEX idx_usage_logs_usage_date ON usage_logs(usage_date);

-- ============================================
-- Row Level Security (RLS) 策略
-- ============================================

-- 启用RLS
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE contents ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_contents ENABLE ROW LEVEL SECURITY;
ALTER TABLE publish_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE review_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_logs ENABLE ROW LEVEL SECURITY;

-- Profiles策略
CREATE POLICY "Users can view own profile" ON profiles
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can view same tenant profiles" ON profiles
    FOR SELECT USING (
        tenant_id IN (
            SELECT tenant_id FROM profiles WHERE id = auth.uid()
        )
    );

-- Platform Accounts策略
CREATE POLICY "Users can view own tenant accounts" ON platform_accounts
    FOR ALL USING (
        tenant_id IN (
            SELECT tenant_id FROM profiles WHERE id = auth.uid()
        )
    );

-- Contents策略
CREATE POLICY "Users can view own tenant contents" ON contents
    FOR ALL USING (
        tenant_id IN (
            SELECT tenant_id FROM profiles WHERE id = auth.uid()
        )
    );

-- Publish Tasks策略
CREATE POLICY "Users can view own tenant tasks" ON publish_tasks
    FOR ALL USING (
        tenant_id IN (
            SELECT tenant_id FROM profiles WHERE id = auth.uid()
        )
    );

-- ============================================
-- 触发器：自动更新 updated_at
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_tenants_updated_at BEFORE UPDATE ON tenants
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_platform_accounts_updated_at BEFORE UPDATE ON platform_accounts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_contents_updated_at BEFORE UPDATE ON contents
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
