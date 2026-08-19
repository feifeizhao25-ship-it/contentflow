import { Injectable, OnModuleInit, Logger } from '@nestjs/common';

// 类型定义
interface MockQueryOptions {
  where?: any;
  include?: any;
  select?: any;
  orderBy?: any;
  skip?: number;
  take?: number;
  distinct?: boolean;
}

interface MockFindFirstOptions {
  where?: any;
  include?: any;
}

interface MockCreateOptions {
  data: any;
}

interface MockUpdateOptions {
  where: { id: string } | any;
  data: any;
}

interface MockDeleteOptions {
  where: { id: string } | any;
}

interface MockAggregateOptions {
  where?: any;
  select?: any;
  _count?: any;
  _sum?: any;
}

@Injectable()
export class PrismaService implements OnModuleInit {
  private readonly logger = new Logger(PrismaService.name);
  mockMode = false;

  // Mock 数据存储
  private mockDb: Record<string, any[]> = {
    users: [],
    tenants: [],
    contents: [],
    platform_accounts: [],
    publish_tasks: [],
    profiles: [],
    teams: [],
    team_members: [],
    // 积分系统 (V1)
    user_points: [],
    points_logs: [],
    rewards: [],
    redemption_records: [],
    achievements: [],
    user_achievements: [],
    quests: [],
    user_quests: [],
    // V2 新增
    invitation_records: [],
    invitation_leaderboards: [],
    user_data_assets: [],
    paywall_triggers: [],
    onboarding_progress: [],
    content_viral_scores: [],
    ai_style_learning: [],
    hot_topics: [],
    viral_contents: [],
    competitors: [],
    // V1 遗留表
    review_logs: [],
    materials: [],
  };

  async onModuleInit() {
    const useMockDb = process.env.USE_MOCK_DB === 'true' ||
      process.env.DATABASE_URL?.includes('placeholder') ||
      !process.env.DATABASE_URL ||
      process.env.DATABASE_URL?.includes('localhost:5432');

    this.mockMode = !!useMockDb;

    if (this.mockMode) {
      this.logger.warn('🔶 使用开发模式 - 数据库操作将被模拟（Mock）');
      this.initMockData();
    } else {
      this.logger.log('需要真实数据库连接 - 请配置 DATABASE_URL');
    }
  }

  private initMockData() {
    // 演示租户
    this.mockDb.tenants.push({
      id: 'tenant_demo_1',
      name: '示例工作室',
      slug: 'demo_studio',
      status: 'active',
      plan: 'free',
      limits: {
        max_accounts: 2,
        max_members: 1,
        max_publishes_monthly: 30,
        max_ai_calls_monthly: 20,
        max_storage_gb: 1,
      },
      usage_stats: {
        accounts_count: 0,
        members_count: 1,
        publishes_this_month: 0,
        ai_calls_this_month: 0,
        storage_used_mb: 0,
      },
      created_at: new Date(),
      updated_at: new Date(),
    });

    // 演示用户
    this.mockDb.users.push({
      id: 'user_demo_1',
      tenant_id: 'tenant_demo_1',
      email: 'demo@example.com',
      password_hash: '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/X4aYJGYxMnC6C5.Oy',
      name: '演示用户',
      role: 'owner',
      status: 'active',
      email_verified: true,
      login_count: 0,
      last_login_at: null,
      created_at: new Date(),
      updated_at: new Date(),
    });

    // 初始化积分系统数据
    this.mockDb.user_points.push({
      id: 'points_demo_1',
      user_id: 'user_demo_1',
      balance: 100,
      total_earned: 150,
      total_spent: 50,
      streak_days: 3,
      last_checkin_date: new Date(),
      longest_streak: 7,
      level: 2,
      experience_points: 150,
      created_at: new Date(),
      updated_at: new Date(),
    });

    // 初始化任务
    this.mockDb.quests.push(
      {
        id: 'quest_checkin',
        title: '每日签到',
        description: '每天签到获得积分',
        category: 'daily',
        is_daily: true,
        is_active: true,
        points_reward: 5,
        sort_order: 1,
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        id: 'quest_create_content',
        title: '创作内容',
        description: '使用AI创作一篇内容',
        category: 'daily',
        is_daily: true,
        is_active: true,
        points_reward: 10,
        sort_order: 2,
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        id: 'quest_publish',
        title: '发布内容',
        description: '发布一篇内容到平台',
        category: 'daily',
        is_daily: true,
        is_active: true,
        points_reward: 15,
        sort_order: 3,
        created_at: new Date(),
        updated_at: new Date(),
      }
    );

    // 初始化成就
    this.mockDb.achievements.push(
      {
        id: 'ach_first_step',
        name: '初试啼声',
        description: '完成首次创作',
        category: 'milestone',
        condition_type: 'contents_published',
        condition_value: { count: 1 },
        points_reward: 50,
        is_active: true,
        sort_order: 1,
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        id: 'ach_viral_maker',
        name: '爆款制造',
        description: '创作一篇爆款内容',
        category: 'content',
        condition_type: 'viral_content',
        condition_value: { views: 10000 },
        points_reward: 100,
        is_active: true,
        sort_order: 2,
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        id: 'ach_loyal_user',
        name: '忠实用户',
        description: '连续使用7天',
        category: 'milestone',
        condition_type: 'checkin_streak',
        condition_value: { days: 7 },
        points_reward: 70,
        is_active: true,
        sort_order: 3,
        created_at: new Date(),
        updated_at: new Date(),
      }
    );

    this.logger.log('📦 Mock 数据库已初始化');
  }

  // ========== 通用辅助方法 ==========
  
  private filterByWhere<T>(items: T[], where?: any): T[] {
    if (!where) return items;
    
    let result = [...items];
    
    if (where.tenant_id) {
      result = result.filter((i: any) => i.tenant_id === where.tenant_id);
    }
    if (where.user_id) {
      result = result.filter((i: any) => i.user_id === where.user_id);
    }
    if (where.status) {
      if (Array.isArray(where.status.in)) {
        result = result.filter((i: any) => where.status.in.includes(i.status));
      } else {
        result = result.filter((i: any) => i.status === where.status);
      }
    }
    if (where.content_type) {
      result = result.filter((i: any) => i.content_type === where.content_type);
    }
    if (where.category) {
      result = result.filter((i: any) => i.category === where.category);
    }
    if (where.platform) {
      result = result.filter((i: any) => i.platform === where.platform);
    }
    if (where.is_daily !== undefined) {
      result = result.filter((i: any) => i.is_daily === where.is_daily);
    }
    if (where.is_active !== undefined) {
      result = result.filter((i: any) => i.is_active === where.is_active);
    }
    if (where.log_type) {
      result = result.filter((i: any) => i.log_type === where.log_type);
    }
    if (where.condition_type) {
      result = result.filter((i: any) => i.condition_type === where.condition_type);
    }
    if (where.quest_id) {
      result = result.filter((i: any) => i.quest_id === where.quest_id);
    }
    
    return result;
  }

  private orderByFunc<T>(items: T[], orderBy?: any): T[] {
    if (!orderBy) return items;
    
    const key = Object.keys(orderBy)[0];
    const dir = orderBy[key];
    
    return items.sort((a: any, b: any) => {
      const aVal = a[key];
      const bVal = b[key];
      
      if (typeof aVal === 'string') {
        return dir === 'desc' 
          ? bVal.localeCompare(aVal) 
          : aVal.localeCompare(bVal);
      }
      
      if (aVal instanceof Date && bVal instanceof Date) {
        return dir === 'desc' 
          ? bVal.getTime() - aVal.getTime() 
          : aVal.getTime() - bVal.getTime();
      }
      
      return dir === 'desc' ? (bVal > aVal ? 1 : -1) : (aVal > bVal ? 1 : -1);
    });
  }

  // ========== User ==========
  
  get user() {
    return {
      findFirst: async ({ where }: { where?: any } = {}) => {
        const items = this.filterByWhere(this.mockDb.users, where);
        return items[0] || null;
      },
      findUnique: async ({ where, include }: { where: { id: string }; include?: any }) => {
        const user = this.mockDb.users.find(u => u.id === where.id) || null;
        if (user && include?.tenant) {
          user.tenant = this.mockDb.tenants.find(t => t.id === user.tenant_id);
        }
        return user;
      },
      findMany: async ({ where, orderBy, skip, take }: MockQueryOptions = {}) => {
        let items = this.filterByWhere(this.mockDb.users, where);
        items = this.orderByFunc(items, orderBy);
        if (skip) items = items.slice(skip);
        if (take) items = items.slice(0, take);
        return items;
      },
      create: async ({ data }: MockCreateOptions) => {
        const newUser = {
          id: `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          ...data,
          status: 'active',
          email_verified: false,
          login_count: 0,
          last_login_at: null,
          created_at: new Date(),
          updated_at: new Date(),
        };
        this.mockDb.users.push(newUser);
        return newUser;
      },
      update: async ({ where, data }: MockUpdateOptions) => {
        const idx = this.mockDb.users.findIndex(u => u.id === where.id);
        if (idx !== -1) {
          this.mockDb.users[idx] = {
            ...this.mockDb.users[idx],
            ...data,
            updated_at: new Date(),
          };
          return this.mockDb.users[idx];
        }
        return null;
      },
      delete: async ({ where }: MockDeleteOptions) => {
        const idx = this.mockDb.users.findIndex(u => u.id === where.id);
        if (idx !== -1) {
          const [deleted] = this.mockDb.users.splice(idx, 1);
          return deleted;
        }
        return null;
      },
      count: async ({ where }: { where?: any } = {}) => {
        return this.filterByWhere(this.mockDb.users, where).length;
      },
    };
  }

  // ========== Tenant ==========
  
  get tenant() {
    return {
      create: async ({ data }: MockCreateOptions) => {
        const newTenant = {
          id: `tenant_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          ...data,
          status: 'active',
          plan: 'free',
          created_at: new Date(),
          updated_at: new Date(),
        };
        this.mockDb.tenants.push(newTenant);
        return newTenant;
      },
      findUnique: async ({ where }: { where: { id: string } }) => {
        return this.mockDb.tenants.find(t => t.id === where.id) || null;
      },
      findFirst: async ({ where }: { where?: any } = {}) => {
        return this.mockDb.tenants.find(t => t.id === where.id || t.slug === where.slug) || null;
      },
      update: async ({ where, data }: MockUpdateOptions) => {
        const idx = this.mockDb.tenants.findIndex(t => t.id === where.id);
        if (idx !== -1) {
          this.mockDb.tenants[idx] = {
            ...this.mockDb.tenants[idx],
            ...data,
            updated_at: new Date(),
          };
          return this.mockDb.tenants[idx];
        }
        return null;
      },
      findMany: async ({ where, orderBy, skip, take }: MockQueryOptions = {}) => {
        let items = this.filterByWhere(this.mockDb.tenants, where);
        items = this.orderByFunc(items, orderBy);
        if (skip) items = items.slice(skip);
        if (take) items = items.slice(0, take);
        return items;
      },
    };
  }

  // ========== Content ==========
  
  get content() {
    return {
      findMany: async ({ where, orderBy, skip, take, select }: MockQueryOptions = {}) => {
        let items = this.filterByWhere(this.mockDb.contents, where);
        items = this.orderByFunc(items, orderBy);
        if (skip) items = items.slice(skip);
        if (take) items = items.slice(0, take);
        // 支持 select
        if (select) {
          items = items.map((item: any) => {
            const newItem: any = {};
            Object.keys(select).forEach(key => {
              if (key === 'status' || key === 'content_type') {
                newItem[key] = item[key];
              }
            });
            return newItem;
          });
        }
        return items;
      },
      findUnique: async ({ where }: { where: { id: string } }) => {
        return this.mockDb.contents.find(c => c.id === where.id) || null;
      },
      findFirst: async ({ where }: { where?: any } = {}) => {
        const items = this.filterByWhere(this.mockDb.contents, where);
        return items[0] || null;
      },
      create: async ({ data }: MockCreateOptions) => {
        const newContent = {
          id: `content_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          ...data,
          status: 'draft',
          version: 1,
          created_at: new Date(),
          updated_at: new Date(),
        };
        this.mockDb.contents.push(newContent);
        return newContent;
      },
      update: async ({ where, data }: MockUpdateOptions) => {
        const idx = this.mockDb.contents.findIndex(c => c.id === where.id);
        if (idx !== -1) {
          this.mockDb.contents[idx] = {
            ...this.mockDb.contents[idx],
            ...data,
            updated_at: new Date(),
          };
          return this.mockDb.contents[idx];
        }
        return null;
      },
      delete: async ({ where }: MockDeleteOptions) => {
        const idx = this.mockDb.contents.findIndex(c => c.id === where.id);
        if (idx !== -1) {
          const [deleted] = this.mockDb.contents.splice(idx, 1);
          return deleted;
        }
        return null;
      },
      count: async ({ where }: { where?: any } = {}) => {
        return this.filterByWhere(this.mockDb.contents, where).length;
      },
    };
  }

  // ========== PlatformAccount ==========
  
  get platformAccount() {
    return this.platform_account;
  }

  get platform_account() {
    return {
      findMany: async ({ where, orderBy, skip, take, select }: MockQueryOptions = {}) => {
        let items = this.filterByWhere(this.mockDb.platform_accounts, where);
        items = this.orderByFunc(items, orderBy);
        if (skip) items = items.slice(skip);
        if (take) items = items.slice(0, take);
        if (select) {
          items = items.map((item: any) => {
            const newItem: any = {};
            if (select.status) newItem.status = item.status;
            if (select.platform) newItem.platform = item.platform;
            if (select.follower_count) newItem.follower_count = item.follower_count;
            return newItem;
          });
        }
        return items;
      },
      findUnique: async ({ where }: { where: { id: string } }) => {
        return this.mockDb.platform_accounts.find(a => a.id === where.id) || null;
      },
      findFirst: async ({ where }: { where?: any } = {}) => {
        const items = this.filterByWhere(this.mockDb.platform_accounts, where);
        return items[0] || null;
      },
      create: async ({ data }: MockCreateOptions) => {
        const newAccount = {
          id: `account_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          ...data,
          status: 'active',
          health_score: 100,
          follower_count: 0,
          following_count: 0,
          content_count: 0,
          created_at: new Date(),
          updated_at: new Date(),
        };
        this.mockDb.platform_accounts.push(newAccount);
        return newAccount;
      },
      update: async ({ where, data }: MockUpdateOptions) => {
        const idx = this.mockDb.platform_accounts.findIndex(a => a.id === where.id);
        if (idx !== -1) {
          this.mockDb.platform_accounts[idx] = {
            ...this.mockDb.platform_accounts[idx],
            ...data,
            updated_at: new Date(),
          };
          return this.mockDb.platform_accounts[idx];
        }
        return null;
      },
      delete: async ({ where }: MockDeleteOptions) => {
        const idx = this.mockDb.platform_accounts.findIndex(a => a.id === where.id);
        if (idx !== -1) {
          const [deleted] = this.mockDb.platform_accounts.splice(idx, 1);
          return deleted;
        }
        return null;
      },
    };
  }

  // ========== PublishTask ==========
  
  get publishTask() {
    return this.publish_task;
  }

  get publish_task() {
    return {
      findMany: async ({ where, orderBy, skip, take }: MockQueryOptions = {}) => {
        let items = this.filterByWhere(this.mockDb.publish_tasks, where);
        items = this.orderByFunc(items, orderBy);
        if (skip) items = items.slice(skip);
        if (take) items = items.slice(0, take);
        return items;
      },
      findUnique: async ({ where }: { where: { id: string } }) => {
        return this.mockDb.publish_tasks.find(t => t.id === where.id) || null;
      },
      findFirst: async ({ where }: { where?: any } = {}) => {
        const items = this.filterByWhere(this.mockDb.publish_tasks, where);
        return items[0] || null;
      },
      create: async ({ data }: MockCreateOptions) => {
        const newTask = {
          id: `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          ...data,
          status: 'pending',
          retry_count: 0,
          max_retries: 3,
          progress: 0,
          created_at: new Date(),
          updated_at: new Date(),
        };
        this.mockDb.publish_tasks.push(newTask);
        return newTask;
      },
      update: async ({ where, data }: MockUpdateOptions) => {
        const idx = this.mockDb.publish_tasks.findIndex(t => t.id === where.id);
        if (idx !== -1) {
          this.mockDb.publish_tasks[idx] = {
            ...this.mockDb.publish_tasks[idx],
            ...data,
            updated_at: new Date(),
          };
          return this.mockDb.publish_tasks[idx];
        }
        return null;
      },
      delete: async ({ where }: MockDeleteOptions) => {
        const idx = this.mockDb.publish_tasks.findIndex(t => t.id === where.id);
        if (idx !== -1) {
          const [deleted] = this.mockDb.publish_tasks.splice(idx, 1);
          return deleted;
        }
        return null;
      },
      aggregate: async ({ where, _count }: MockAggregateOptions = {}) => {
        const items = this.filterByWhere(this.mockDb.publish_tasks, where);
        const result: any = { _count: {} };
        if (_count?.id) result._count.id = items.length;
        return result;
      },
      count: async ({ where }: { where?: any } = {}) => {
        return this.filterByWhere(this.mockDb.publish_tasks, where).length;
      },
    };
  }

  // ========== UserPoints ==========
  
  get userPoints() {
    return {
      findUnique: async ({ where }: { where: { user_id: string } }) => {
        return this.mockDb.user_points.find(p => p.user_id === where.user_id) || null;
      },
      findFirst: async ({ where }: { where?: any } = {}) => {
        const items = this.filterByWhere(this.mockDb.user_points, where);
        return items[0] || null;
      },
      create: async ({ data }: MockCreateOptions) => {
        const newPoints = {
          id: `points_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          ...data,
          balance: data.balance ?? 0,
          total_earned: data.total_earned ?? 0,
          total_spent: data.total_spent ?? 0,
          streak_days: data.streak_days ?? 0,
          longest_streak: data.longest_streak ?? 0,
          level: data.level ?? 1,
          experience_points: data.experience_points ?? 0,
          created_at: new Date(),
          updated_at: new Date(),
        };
        this.mockDb.user_points.push(newPoints);
        return newPoints;
      },
      update: async ({ where, data }: MockUpdateOptions) => {
        const idx = this.mockDb.user_points.findIndex(p => p.user_id === where.user_id);
        if (idx !== -1) {
          const current = this.mockDb.user_points[idx];
          const updated = { ...current };
          
          if (data.balance?.increment) updated.balance = (current.balance || 0) + data.balance.increment;
          else if (data.balance?.decrement) updated.balance = (current.balance || 0) - data.balance.decrement;
          else if (data.balance !== undefined) updated.balance = data.balance;

          if (data.total_earned?.increment) updated.total_earned = (current.total_earned || 0) + data.total_earned.increment;
          else if (data.total_earned !== undefined) updated.total_earned = data.total_earned;

          if (data.total_spent?.increment) updated.total_spent = (current.total_spent || 0) + data.total_spent.increment;
          else if (data.total_spent !== undefined) updated.total_spent = data.total_spent;

          if (data.experience_points?.increment) updated.experience_points = (current.experience_points || 0) + data.experience_points.increment;
          else if (data.experience_points !== undefined) updated.experience_points = data.experience_points;

          if (data.streak_days !== undefined) updated.streak_days = data.streak_days;
          if (data.last_checkin_date !== undefined) updated.last_checkin_date = data.last_checkin_date;
          if (data.level !== undefined) updated.level = data.level;

          updated.updated_at = new Date();
          this.mockDb.user_points[idx] = updated;
          return updated;
        }
        return null;
      },
      upsert: async ({ where, create, update }: any) => {
        const existing = this.mockDb.user_points.find(p => p.user_id === where.user_id);
        if (existing) {
          return this.userPoints.update({ where, data: update });
        }
        return this.userPoints.create({ data: create });
      },
    };
  }

  // ========== PointsLog ==========
  
  get pointsLog() {
    return {
      create: async ({ data }: MockCreateOptions) => {
        const newLog = {
          id: `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          ...data,
          created_at: new Date(),
        };
        this.mockDb.points_logs.push(newLog);
        return newLog;
      },
      findMany: async ({ where, orderBy, skip, take }: MockQueryOptions = {}) => {
        let logs = this.filterByWhere(this.mockDb.points_logs, where);
        logs = this.orderByFunc(logs, orderBy);
        if (skip) logs = logs.slice(skip);
        if (take) logs = logs.slice(0, take);
        return logs;
      },
      count: async ({ where }: { where?: any } = {}) => {
        return this.filterByWhere(this.mockDb.points_logs, where).length;
      },
    };
  }

  // ========== Reward ==========
  
  get reward() {
    return {
      findMany: async ({ where, orderBy, skip, take }: MockQueryOptions = {}) => {
        let rewards = this.filterByWhere(this.mockDb.rewards, where);
        rewards = this.orderByFunc(rewards, orderBy);
        if (skip) rewards = rewards.slice(skip);
        if (take) rewards = rewards.slice(0, take);
        return rewards;
      },
      findUnique: async ({ where }: { where: { id: string } }) => {
        return this.mockDb.rewards.find(r => r.id === where.id) || null;
      },
      findFirst: async ({ where }: { where?: any } = {}) => {
        const items = this.filterByWhere(this.mockDb.rewards, where);
        return items[0] || null;
      },
      create: async ({ data }: MockCreateOptions) => {
        const newReward = {
          id: `reward_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          ...data,
          is_active: data.is_active ?? true,
          is_featured: data.is_featured ?? false,
          stock_unlimited: data.stock_unlimited ?? false,
          sort_order: data.sort_order ?? 0,
          created_at: new Date(),
          updated_at: new Date(),
        };
        this.mockDb.rewards.push(newReward);
        return newReward;
      },
      update: async ({ where, data }: MockUpdateOptions) => {
        const idx = this.mockDb.rewards.findIndex(r => r.id === where.id);
        if (idx !== -1) {
          this.mockDb.rewards[idx] = {
            ...this.mockDb.rewards[idx],
            ...data,
            updated_at: new Date(),
          };
          return this.mockDb.rewards[idx];
        }
        return null;
      },
      count: async ({ where }: { where?: any } = {}) => {
        return this.filterByWhere(this.mockDb.rewards, where).length;
      },
    };
  }

  // ========== RedemptionRecord ==========
  
  get redemptionRecord() {
    return {
      findMany: async ({ where, orderBy, skip, take }: MockQueryOptions = {}) => {
        let records = this.filterByWhere(this.mockDb.redemption_records, where);
        records = this.orderByFunc(records, orderBy);
        if (skip) records = records.slice(skip);
        if (take) records = records.slice(0, take);
        return records;
      },
      findFirst: async ({ where }: { where: any }) => {
        const items = this.filterByWhere(this.mockDb.redemption_records, where);
        return items[0] || null;
      },
      count: async ({ where }: { where?: any } = {}) => {
        return this.filterByWhere(this.mockDb.redemption_records, where).length;
      },
      create: async ({ data }: MockCreateOptions) => {
        const newRecord = {
          id: `redemption_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          ...data,
          status: data.status ?? 'pending',
          created_at: new Date(),
          updated_at: new Date(),
        };
        this.mockDb.redemption_records.push(newRecord);
        return newRecord;
      },
      update: async ({ where, data }: MockUpdateOptions) => {
        const idx = this.mockDb.redemption_records.findIndex(r => r.id === where.id);
        if (idx !== -1) {
          this.mockDb.redemption_records[idx] = {
            ...this.mockDb.redemption_records[idx],
            ...data,
            updated_at: new Date(),
          };
          return this.mockDb.redemption_records[idx];
        }
        return null;
      },
    };
  }

  // ========== Achievement ==========
  
  get achievement() {
    return {
      findMany: async ({ where, orderBy }: MockQueryOptions = {}) => {
        let items = this.filterByWhere(this.mockDb.achievements, where);
        items = this.orderByFunc(items, orderBy);
        return items;
      },
      findUnique: async ({ where }: { where: { id: string } }) => {
        return this.mockDb.achievements.find(a => a.id === where.id) || null;
      },
      findFirst: async ({ where }: { where?: any } = {}) => {
        const items = this.filterByWhere(this.mockDb.achievements, where);
        return items[0] || null;
      },
      create: async ({ data }: MockCreateOptions) => {
        const newAchievement = {
          id: `achievement_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          ...data,
          is_active: data.is_active ?? true,
          sort_order: data.sort_order ?? 0,
          created_at: new Date(),
          updated_at: new Date(),
        };
        this.mockDb.achievements.push(newAchievement);
        return newAchievement;
      },
      count: async ({ where }: { where?: any } = {}) => {
        return this.filterByWhere(this.mockDb.achievements, where).length;
      },
    };
  }

  // ========== UserAchievement ==========
  
  get userAchievement() {
    return {
      findMany: async ({ where }: { where?: any } = {}) => {
        return this.filterByWhere(this.mockDb.user_achievements, where);
      },
      findUnique: async ({ where }: { where: { user_id_achievement_id: { user_id: string; achievement_id: string } } }) => {
        return this.mockDb.user_achievements.find(
          a => a.user_id === where.user_id_achievement_id.user_id && 
              a.achievement_id === where.user_id_achievement_id.achievement_id
        ) || null;
      },
      findFirst: async ({ where }: { where?: any } = {}) => {
        const items = this.filterByWhere(this.mockDb.user_achievements, where);
        return items[0] || null;
      },
      create: async ({ data }: MockCreateOptions) => {
        const newUserAchievement = {
          id: `user_achievement_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          ...data,
          progress: data.progress ?? 0,
          is_unlocked: data.is_unlocked ?? false,
          points_claimed: data.points_claimed ?? false,
          created_at: new Date(),
          updated_at: new Date(),
        };
        this.mockDb.user_achievements.push(newUserAchievement);
        return newUserAchievement;
      },
      update: async ({ where, data }: MockUpdateOptions) => {
        const idx = this.mockDb.user_achievements.findIndex(a => a.id === where.id);
        if (idx !== -1) {
          this.mockDb.user_achievements[idx] = {
            ...this.mockDb.user_achievements[idx],
            ...data,
            updated_at: new Date(),
          };
          return this.mockDb.user_achievements[idx];
        }
        return null;
      },
      upsert: async ({ where, create, update }: any) => {
        const existing = this.mockDb.user_achievements.find(
          a => a.user_id === where.user_id && a.achievement_id === where.achievement_id
        );
        if (existing) {
          return this.userAchievement.update({ where: { id: existing.id }, data: update });
        }
        return this.userAchievement.create({ data: create });
      },
    };
  }

  // ========== Quest ==========
  
  get quest() {
    return {
      findMany: async ({ where, orderBy }: MockQueryOptions = {}) => {
        let items = this.filterByWhere(this.mockDb.quests, where);
        items = this.orderByFunc(items, orderBy);
        return items;
      },
      findUnique: async ({ where }: { where: { id: string } }) => {
        return this.mockDb.quests.find(q => q.id === where.id) || null;
      },
      findFirst: async ({ where }: { where?: any } = {}) => {
        const items = this.filterByWhere(this.mockDb.quests, where);
        return items[0] || null;
      },
      create: async ({ data }: MockCreateOptions) => {
        const newQuest = {
          id: `quest_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          ...data,
          is_active: data.is_active ?? true,
          is_daily: data.is_daily ?? false,
          sort_order: data.sort_order ?? 0,
          created_at: new Date(),
          updated_at: new Date(),
        };
        this.mockDb.quests.push(newQuest);
        return newQuest;
      },
      count: async ({ where }: { where?: any } = {}) => {
        return this.filterByWhere(this.mockDb.quests, where).length;
      },
    };
  }

  // ========== UserQuest ==========
  
  get userQuest() {
    return {
      findMany: async ({ where }: { where?: any } = {}) => {
        return this.filterByWhere(this.mockDb.user_quests, where);
      },
      findFirst: async ({ where }: { where: any }) => {
        const items = this.filterByWhere(this.mockDb.user_quests, where);
        return items[0] || null;
      },
      create: async ({ data }: MockCreateOptions) => {
        const newUserQuest = {
          id: `user_quest_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          ...data,
          current_progress: data.current_progress ?? 0,
          is_completed: data.is_completed ?? false,
          points_claimed: data.points_claimed ?? false,
          created_at: new Date(),
          updated_at: new Date(),
        };
        this.mockDb.user_quests.push(newUserQuest);
        return newUserQuest;
      },
      update: async ({ where, data }: MockUpdateOptions) => {
        const idx = this.mockDb.user_quests.findIndex(q => q.id === where.id);
        if (idx !== -1) {
          this.mockDb.user_quests[idx] = {
            ...this.mockDb.user_quests[idx],
            ...data,
            updated_at: new Date(),
          };
          return this.mockDb.user_quests[idx];
        }
        return null;
      },
      delete: async ({ where }: MockDeleteOptions) => {
        const idx = this.mockDb.user_quests.findIndex(q => q.id === where.id);
        if (idx !== -1) {
          const [deleted] = this.mockDb.user_quests.splice(idx, 1);
          return deleted;
        }
        return null;
      },
      upsert: async ({ where, create, update }: any) => {
        const existing = this.mockDb.user_quests.find(
          q => q.user_id === where.user_id && q.quest_id === where.quest_id
        );
        if (existing) {
          return this.userQuest.update({ where: { id: existing.id }, data: update });
        }
        return this.userQuest.create({ data: create });
      },
      count: async ({ where }: { where?: any } = {}) => {
        return this.filterByWhere(this.mockDb.user_quests, where).length;
      },
    };
  }

  // ========== V2 新增表 ==========

  // InvitationRecord
  get invitationRecord() {
    return {
      create: async ({ data }: MockCreateOptions) => {
        const newRecord = {
          id: `invitation_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          ...data,
          status: data.status ?? 'pending',
          created_at: new Date(),
          updated_at: new Date(),
        };
        this.mockDb.invitation_records.push(newRecord);
        return newRecord;
      },
      findUnique: async ({ where }: { where: { id: string } }) => {
        return this.mockDb.invitation_records.find(r => r.id === where.id) || null;
      },
      findFirst: async ({ where }: { where?: any } = {}) => {
        if (where.inviteCode) {
          return this.mockDb.invitation_records.find(r => r.inviteCode === where.inviteCode) || null;
        }
        const items = this.filterByWhere(this.mockDb.invitation_records, where);
        return items[0] || null;
      },
      findMany: async ({ where, orderBy, skip, take }: MockQueryOptions = {}) => {
        let items = this.filterByWhere(this.mockDb.invitation_records, where);
        items = this.orderByFunc(items, orderBy);
        if (skip) items = items.slice(skip);
        if (take) items = items.slice(0, take);
        return items;
      },
      update: async ({ where, data }: MockUpdateOptions) => {
        const idx = this.mockDb.invitation_records.findIndex(r => r.id === where.id);
        if (idx !== -1) {
          this.mockDb.invitation_records[idx] = {
            ...this.mockDb.invitation_records[idx],
            ...data,
            updated_at: new Date(),
          };
          return this.mockDb.invitation_records[idx];
        }
        return null;
      },
      count: async ({ where }: { where?: any } = {}) => {
        return this.filterByWhere(this.mockDb.invitation_records, where).length;
      },
      groupBy: async ({ by, where, _count }: any) => {
        const items = this.filterByWhere(this.mockDb.invitation_records, where);
        // 简单分组实现
        const groups: Record<string, any[]> = {};
        items.forEach(item => {
          const key = item[by[0]] || 'unknown';
          if (!groups[key]) groups[key] = [];
          groups[key].push(item);
        });
        return Object.entries(groups).map(([key, group]) => ({
          [by[0]]: key,
          _count: { id: group.length },
        }));
      },
    };
  }

  // UserDataAssets
  get userDataAssets() {
    return {
      findUnique: async ({ where }: { where: { user_id: string } }) => {
        return this.mockDb.user_data_assets.find(a => a.user_id === where.user_id) || null;
      },
      create: async ({ data }: MockCreateOptions) => {
        const newAssets = {
          id: `assets_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          ...data,
          total_contents: data.total_contents ?? 0,
          total_words: data.total_words ?? 0,
          total_images: data.total_images ?? 0,
          total_videos: data.total_videos ?? 0,
          ai_learning_samples: data.ai_learning_samples ?? 0,
          ai_style_profile: data.ai_style_profile ?? {},
          total_views: data.total_views ?? 0,
          total_likes: data.total_likes ?? 0,
          total_followers_gained: data.total_followers_gained ?? 0,
          total_days_used: data.total_days_used ?? 0,
          total_publishes: data.total_publishes ?? 0,
          total_ai_generations: data.total_ai_generations ?? 0,
          created_at: new Date(),
          updated_at: new Date(),
        };
        this.mockDb.user_data_assets.push(newAssets);
        return newAssets;
      },
      update: async ({ where, data }: MockUpdateOptions) => {
        const idx = this.mockDb.user_data_assets.findIndex(a => a.user_id === where.user_id);
        if (idx !== -1) {
          this.mockDb.user_data_assets[idx] = {
            ...this.mockDb.user_data_assets[idx],
            ...data,
            updated_at: new Date(),
          };
          return this.mockDb.user_data_assets[idx];
        }
        return null;
      },
      upsert: async ({ where, create, update }: any) => {
        const existing = this.mockDb.user_data_assets.find(a => a.user_id === where.user_id);
        if (existing) {
          return this.userDataAssets.update({ where: { user_id: where.user_id }, data: update });
        }
        return this.userDataAssets.create({ data: create });
      },
    };
  }

  // PaywallTrigger
  get paywallTrigger() {
    return {
      create: async ({ data }: MockCreateOptions) => {
        const newTrigger = {
          id: `paywall_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          ...data,
          converted: data.converted ?? false,
          created_at: new Date(),
        };
        this.mockDb.paywall_triggers.push(newTrigger);
        return newTrigger;
      },
      findMany: async ({ where, orderBy, skip, take }: MockQueryOptions = {}) => {
        let items = this.filterByWhere(this.mockDb.paywall_triggers, where);
        items = this.orderByFunc(items, orderBy);
        if (skip) items = items.slice(skip);
        if (take) items = items.slice(0, take);
        return items;
      },
    };
  }

  // OnboardingProgress
  get onboardingProgress() {
    return {
      findUnique: async ({ where }: { where: { user_id: string } }) => {
        return this.mockDb.onboarding_progress.find(p => p.user_id === where.user_id) || null;
      },
      create: async ({ data }: MockCreateOptions) => {
        const newProgress = {
          id: `onboarding_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          ...data,
          step_1_completed: data.step_1_completed ?? false,
          step_2_completed: data.step_2_completed ?? false,
          step_3_completed: data.step_3_completed ?? false,
          step_4_completed: data.step_4_completed ?? false,
          step_5_completed: data.step_5_completed ?? false,
          onboarding_completed: data.onboarding_completed ?? false,
          skip_count: data.skip_count ?? 0,
          created_at: new Date(),
          updated_at: new Date(),
        };
        this.mockDb.onboarding_progress.push(newProgress);
        return newProgress;
      },
      update: async ({ where, data }: MockUpdateOptions) => {
        const idx = this.mockDb.onboarding_progress.findIndex(p => p.user_id === where.user_id);
        if (idx !== -1) {
          this.mockDb.onboarding_progress[idx] = {
            ...this.mockDb.onboarding_progress[idx],
            ...data,
            updated_at: new Date(),
          };
          return this.mockDb.onboarding_progress[idx];
        }
        return null;
      },
      upsert: async ({ where, create, update }: any) => {
        const existing = this.mockDb.onboarding_progress.find(p => p.user_id === where.user_id);
        if (existing) {
          return this.onboardingProgress.update({ where: { user_id: where.user_id }, data: update });
        }
        return this.onboardingProgress.create({ data: create });
      },
    };
  }

  // ContentViralScore
  get contentViralScore() {
    return {
      create: async ({ data }: MockCreateOptions) => {
        const newScore = {
          id: `viral_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          ...data,
          title_score: data.title_score ?? 0,
          content_score: data.content_score ?? 0,
          engagement_score: data.engagement_score ?? 0,
          timing_score: data.timing_score ?? 0,
          overall_score: data.overall_score ?? 0,
          analysis: data.analysis ?? {},
          suggestions: data.suggestions ?? [],
          created_at: new Date(),
        };
        this.mockDb.content_viral_scores.push(newScore);
        return newScore;
      },
      findMany: async ({ where, orderBy, skip, take }: MockQueryOptions = {}) => {
        let items = this.filterByWhere(this.mockDb.content_viral_scores, where);
        items = this.orderByFunc(items, orderBy);
        if (skip) items = items.slice(skip);
        if (take) items = items.slice(0, take);
        return items;
      },
    };
  }

  // AIStyleLearning
  get aiStyleLearning() {
    return {
      create: async ({ data }: MockCreateOptions) => {
        const newLearning = {
          id: `style_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          ...data,
          learned_features: data.learned_features ?? {},
          sample_type: data.sample_type ?? 'original',
          learning_weight: data.learning_weight ?? 1.0,
          created_at: new Date(),
        };
        this.mockDb.ai_style_learning.push(newLearning);
        return newLearning;
      },
      findMany: async ({ where }: { where?: any } = {}) => {
        return this.filterByWhere(this.mockDb.ai_style_learning, where);
      },
    };
  }

  // HotTopic
  get hotTopic() {
    return {
      findMany: async ({ where, orderBy, skip, take }: MockQueryOptions = {}) => {
        let items = this.filterByWhere(this.mockDb.hot_topics, where);
        items = this.orderByFunc(items, orderBy);
        if (skip) items = items.slice(skip);
        if (take) items = items.slice(0, take);
        return items;
      },
      create: async ({ data }: MockCreateOptions) => {
        const newTopic = {
          id: `topic_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          ...data,
          heat_score: data.heat_score ?? 0,
          rank_position: data.rank_position ?? 0,
          is_rising: data.is_rising ?? false,
          crawled_at: new Date(),
        };
        this.mockDb.hot_topics.push(newTopic);
        return newTopic;
      },
    };
  }

  // ViralContent
  get viralContent() {
    return {
      findMany: async ({ where, orderBy, skip, take }: MockQueryOptions = {}) => {
        let items = this.filterByWhere(this.mockDb.viral_contents, where);
        items = this.orderByFunc(items, orderBy);
        if (skip) items = items.slice(skip);
        if (take) items = items.slice(0, take);
        return items;
      },
      create: async ({ data }: MockCreateOptions) => {
        const newContent = {
          id: `viral_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          ...data,
          views: data.views ?? 0,
          likes: data.likes ?? 0,
          comments: data.comments ?? 0,
          shares: data.shares ?? 0,
          analysis: data.analysis ?? {},
          tags: data.tags ?? [],
          crawled_at: new Date(),
        };
        this.mockDb.viral_contents.push(newContent);
        return newContent;
      },
    };
  }

  // AIGeneration (AI生成记录)
  get aIGeneration() {
    return {
      create: async ({ data }: MockCreateOptions) => {
        const newGen = {
          id: `ai_gen_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          ...data,
          generation_type: data.generation_type ?? 'content',
          input_params: data.input_params ?? {},
          status: data.status ?? 'pending',
          tokens_input: data.tokens_input ?? 0,
          tokens_output: data.tokens_output ?? 0,
          cost_amount: data.cost_amount ?? 0,
          created_at: new Date(),
        };
        // 注意：我们需要找到contents表并关联，但这里简化处理
        return newGen;
      },
      findMany: async ({ where, orderBy, skip, take }: MockQueryOptions = {}) => {
        return [];
      },
    };
  }

  // Competitor
  get competitor() {
    return {
      findMany: async ({ where, orderBy, skip, take }: MockQueryOptions = {}) => {
        let items = this.filterByWhere(this.mockDb.competitors, where);
        items = this.orderByFunc(items, orderBy);
        if (skip) items = items.slice(skip);
        if (take) items = items.slice(0, take);
        return items;
      },
      create: async ({ data }: MockCreateOptions) => {
        const newCompetitor = {
          id: `competitor_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          ...data,
          is_active: data.is_active ?? true,
          recent_posts: data.recent_posts ?? {},
          engagement_stats: data.engagement_stats ?? {},
          created_at: new Date(),
          updated_at: new Date(),
        };
        this.mockDb.competitors.push(newCompetitor);
        return newCompetitor;
      },
      update: async ({ where, data }: MockUpdateOptions) => {
        const idx = this.mockDb.competitors.findIndex(c => c.id === where.id);
        if (idx !== -1) {
          this.mockDb.competitors[idx] = {
            ...this.mockDb.competitors[idx],
            ...data,
            updated_at: new Date(),
          };
          return this.mockDb.competitors[idx];
        }
        return null;
      },
    };
  }

  // ========== 其他辅助表 ==========

  // Team & TeamMember
  get team() {
    return {
      findMany: async ({ where }: { where?: any } = {}) => {
        return this.filterByWhere(this.mockDb.teams, where);
      },
      create: async ({ data }: MockCreateOptions) => {
        const newTeam = {
          id: `team_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          ...data,
          created_at: new Date(),
          updated_at: new Date(),
        };
        this.mockDb.teams.push(newTeam);
        return newTeam;
      },
    };
  }

  get teamMember() {
    return {
      findMany: async ({ where }: { where?: any } = {}) => {
        return this.filterByWhere(this.mockDb.team_members, where);
      },
      create: async ({ data }: MockCreateOptions) => {
        const newMember = {
          id: `member_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          ...data,
          created_at: new Date(),
        };
        this.mockDb.team_members.push(newMember);
        return newMember;
      },
    };
  }

  // Profile
  get profile() {
    return {
      findUnique: async ({ where }: { where: { user_id: string } }) => {
        return null;
      },
      upsert: async ({ where, create, update }: any) => {
        return { id: 'profile_new', ...create, ...update };
      },
    };
  }

  // ReviewLog
  get reviewLog() {
    return {
      create: async ({ data }: MockCreateOptions) => {
        const newLog = {
          id: `review_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          ...data,
          created_at: new Date(),
        };
        this.mockDb.review_logs.push(newLog);
        return newLog;
      },
      findMany: async ({ where }: { where?: any } = {}) => {
        return this.filterByWhere(this.mockDb.review_logs, where);
      },
    };
  }

  // Material
  get material() {
    return {
      findMany: async ({ where, orderBy }: { where?: any; orderBy?: any } = {}) => {
        let items = this.filterByWhere(this.mockDb.materials, where);
        items = this.orderByFunc(items, orderBy);
        return items;
      },
      findUnique: async ({ where }: { where: { id: string } }) => {
        return this.mockDb.materials.find(m => m.id === where.id) || null;
      },
      create: async ({ data }: MockCreateOptions) => {
        const newMaterial = {
          id: `material_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          ...data,
          created_at: new Date(),
          updated_at: new Date(),
        };
        this.mockDb.materials.push(newMaterial);
        return newMaterial;
      },
      update: async ({ where, data }: MockUpdateOptions) => {
        const idx = this.mockDb.materials.findIndex(m => m.id === where.id);
        if (idx !== -1) {
          this.mockDb.materials[idx] = {
            ...this.mockDb.materials[idx],
            ...data,
            updated_at: new Date(),
          };
          return this.mockDb.materials[idx];
        }
        return null;
      },
      delete: async ({ where }: MockDeleteOptions) => {
        const idx = this.mockDb.materials.findIndex(m => m.id === where.id);
        if (idx !== -1) {
          const [deleted] = this.mockDb.materials.splice(idx, 1);
          return deleted;
        }
        return null;
      },
      count: async ({ where }: { where?: any } = {}) => {
        return this.filterByWhere(this.mockDb.materials, where).length;
      },
    };
  }
}
