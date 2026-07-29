export interface TophubItem {
    id: string;
    Title: string;
    Url: string;
    hot: string;
}

export interface TophubNode {
    id: string;
    name: string;
    data: TophubItem[];
}

export class TophubService {
    private apiKey: string;
    private baseUrl = 'https://api.tophub.today';

    constructor() {
        this.apiKey = process.env.TOPHUB_API_KEY || '';
    }

    /**
     * Map of useful Tophub Node IDs
     */
    static Nodes = {
        Weibo: 'KqndgxeLl9',      // 微博热搜
        Douyin: 'DpQvNABoNE',     // 抖音热榜
        WeChat: 'WnBe01o371',     // 微信热文
        Bilibili: '74KvxwokxM',   // B站全站榜
        Zhihu: 'mproPpoq6O',      // 知乎热榜
        TouTiao: 'f2e4w1593y'     // 今日头条
    };

    /**
     * Fetch hot trends from a specific node
     */
    async getHotData(nodeId: string): Promise<TophubItem[]> {
        if (!this.apiKey) {
            console.warn('TOPHUB_API_KEY is missing');
            return [];
        }

        try {
            const response = await fetch(`${this.baseUrl}/v1/query?id=${nodeId}`, {
                headers: {
                    'Authorization': this.apiKey
                }
            });

            if (!response.ok) {
                console.error(`Tophub API error: ${response.status}`);
                return [];
            }

            const json = await response.json();
            return json.data || [];
        } catch (error) {
            console.error('Tophub fetch error:', error);
            return [];
        }
    }

    /**
     * Get aggregated daily trends tailored for our app
     * Returns mapped format compatible with our Hot Topics page
     */
    async getAggregatedTrends() {
        if (!this.apiKey) return null;

        try {
            // Fetch top 3 platforms concurrently
            const [douyin, weibo, zhihu] = await Promise.all([
                this.getHotData(TophubService.Nodes.Douyin),
                this.getHotData(TophubService.Nodes.Weibo),
                this.getHotData(TophubService.Nodes.Zhihu)
            ]);

            const trends: any[] = [];

            // Helper to map and push
            const processItems = (items: TophubItem[], platform: string, limit: number) => {
                items.slice(0, limit).forEach((item, index) => {
                    // Simple heuristic to determine trend
                    const trend = index < 3 ? 'rising' : 'stable';
                    const heat = item.hot ? parseInt(item.hot.replace(/[^\d]/g, '').slice(0, 2)) || 80 : 80;

                    trends.push({
                        id: `${platform}_${item.id}`,
                        topic: item.Title,
                        platform: platform,
                        heat_score: Math.min(99, heat + (10 - index)), // Fake score based on rank
                        trend: trend,
                        urgency: index < 5 ? 'high' : 'medium',
                        related_hashtags: [`#${platform}热榜`],
                        content_suggestions: ['点击一键创作', '查看详情'],
                        expires_in: '24小时'
                    });
                });
            };

            processItems(douyin, '抖音', 5);
            processItems(weibo, '微博', 5);
            processItems(zhihu, '知乎', 5);

            // Shuffle slightly to mix platforms
            return trends.sort(() => Math.random() - 0.5);

        } catch (error) {
            console.error('Failed to aggregate trends:', error);
            return null;
        }
    }
}

export const tophubService = new TophubService();
