# API and Data Service Architecture Strategy

## 1. Platform Publishing APIs

### 1.1 Official Open Platform APIs (Priority)

| Platform | API Name | Purpose | Cost | Requirements | Official Docs |
|-----|--------|------|------|---------|---------|
| WeChat OA | WeChat Official Account Platform API | Article publishing, data retrieval | Free | Verified Service Account | open.weixin.qq.com |
| WeChat Channels | Channels Assistant API | Video publishing, data | Free | Enterprise Certification | channels.weixin.qq.com |
| Douyin | Douyin Open Platform | Video publishing, data | Free | Enterprise Qualification | open.douyin.com |
| Kuaishou | Kuaishou Open Platform | Video publishing, data | Free | Enterprise Qualification | open.kuaishou.com |
| Bilibili | Bilibili Open Platform | Video submission, data | Free | Real-name Authentication | open.bilibili.com |
| Weibo | Weibo Open Platform | Image/Text publishing, data | Free | Developer Certification | open.weibo.com |
| Zhihu | Zhihu Open Platform | Limited capabilities | Free | Invitation only | open.zhihu.com |
| Xiaohongshu | Xiaohongshu Open Platform | Note publishing (Enterprise) | Free | Enterprise Certification | open.xiaohongshu.com |
| Toutiao | Toutiao Open Platform | Article/Video publishing | Free | Toutiao Account Certification | open.mp.toutiao.com |
| Baijiahao | Baijiahao Open Platform | Article publishing | Free | Baijiahao Certification | openapi.baidu.com |

### 1.2 Supplemental Solutions (No Official API)

| Solution | Applicable Platforms | Implementation | Risk | Cost |
|-----|---------|---------|------|------|
| Browser Extension | Zhihu, Xiaohongshu Personal | User installs plugin, local operation | Low | Development Cost |
| RPA Automation | All Platforms | Yingdao/UiBot etc. | Medium | ¥0.01-0.05/time |
| Third-party Aggregation API | Multi-platform | Yixiaoer API, Newrank API | Medium | ¥0.1-0.5/time |

---

## 2. AI Service APIs

### 2.1 Text Generation (LLM)

| Provider | Model | Price (per 1k tokens) | Features | Recommended Scenario |
|-------|------|-----------------|------|---------|
| **Aliyun - Qwen** | qwen-max | Input ¥0.02/Output ¥0.06 | Strong Chinese, good value | **Primary Model** |
| Aliyun - Qwen | qwen-turbo | Input ¥0.002/Output ¥0.006 | Fast, cheap | Simple tasks |
| Baidu - ERNIE | ERNIE-4.0 | ¥0.12/1k tokens | Strong Chinese understanding | Alternative |
| Baidu - ERNIE | ERNIE-Speed | ¥0.004/1k tokens | Extremely cheap | Batch tasks |
| Zhipu AI | GLM-4 | ¥0.1/1k tokens | Good performance | Alternative |
| Zhipu AI | GLM-4-Flash | Free | Limited quota | Free users |
| Deepseek | deepseek-chat | ¥0.001/1k tokens | Extremely cheap | **Batch Generation** |
| Moonshot | Kimi | ¥0.012/1k tokens | Strong long context | Long articles |
| OpenAI | GPT-4o | $0.005/$0.015 | Best performance | Advanced users |
| OpenAI | GPT-4o-mini | $0.00015/$0.0006 | Cheap | Daily tasks |

**Recommended Combination**:
- Primary: Qwen-max (Good balance)
- Batch: Deepseek (Extreme value)
- Free Users: GLM-4-Flash
- Advanced: GPT-4o

### 2.2 Image Generation

| Provider | Model | Price | Features | Recommended Scenario |
|-------|------|------|------|---------|
| **Aliyun - Wanx** | wanx-v1 | ¥0.04-0.08/image | Good Chinese understanding, fast | **Primary** |
| Baidu - Wenxin Yige | - | ¥0.1/image | Many styles | Alternative |
| Stability AI | SDXL | $0.002-0.006/image | Good quality | High quality needs |
| Midjourney | - | $10/month+ | Best quality | Advanced users |
| Zhipu AI | CogView-3 | ¥0.25/image | Chinese understanding | Alternative |

**Recommendation**: Wanx as primary for best balance.

### 2.3 Video Generation

| Provider | Product | Price | Features | Recommended Scenario |
|-------|------|------|------|---------|
| **Kuaishou - Kling** | Kling | ¥0.14/sec | Strongest domestic model | **Primary** |
| ByteDance - Jimeng | Dreamina | In Beta | Good quality | Future integration |
| Runway | Gen-3 | $0.05/sec | Top tier | Advanced users |
| Pika | Pika 1.0 | $8/month+ | Simple to use | Alternative |
| Aliyun | Text-to-Video | ¥0.1/sec | Template based | Simple videos |

### 2.4 Text-to-Speech (TTS)

| Provider | Product | Price | Features | Recommended Scenario |
|-------|------|------|------|---------|
| **Aliyun** | Intelligent Speech Interaction | ¥2/10k chars | Many voices, stable | **Primary** |
| iFlytek | iFlytek TTS | ¥3.5/10k chars | Natural voices | Alternative |
| Microsoft Azure | Azure TTS | $15/1M chars | Most natural | Advanced users |
| Baidu | Speech Synthesis | ¥2/10k chars | Stable | Alternative |
| Volcano Engine | Speech Synthesis | ¥2/10k chars | ByteDance ecosystem | Alternative |

### 2.5 Content Moderation

| Provider | Product | Price | Recommendation |
|-------|------|------|------|
| **Aliyun** | Content Safety | Image ¥0.0025/ea, Text ¥0.001/ea | **Recommended** |
| Tencent Cloud | Content Safety | Similar | Alternative |
| Baidu | Content Audit | Similar | Alternative |
| NetEase YiDun | Content Safety | Negotiable | Large clients |

---

## 3. Data Service APIs

### 3.1 Hot Trends Data

| Provider | Product | Data Content | Price | Website |
|-------|------|---------|------|------|
| **Newrank** | Newrank Data API | Cross-platform hot content, account data | ¥3000/month+ | newrank.cn |
| **Chanmama** | Open API | Douyin/Kuaishou hot videos, commerce data | ¥2000/month+ | chanmama.com |
| Feigua | Data API | Douyin/Xiaohongshu hot data | ¥2000/month+ | feigua.cn |
| Huitun | Data API | Bilibili hot, Uploader data | ¥1000/month+ | huitun.com |
| Qiangua | Data API | Xiaohongshu hot, influencer data | ¥1500/month+ | qian-gua.com |
| CaasData | Data API | Short video industry data | Negotiable | caasdata.com |

**Recommended Combination**:
- Initial: Newrank (Comprehensive)
- Later: Add Chanmama + Qiangua

### 3.2 Real-time Hot Search

| Source | Method | Price | Content |
|-------|---------|------|------|
| **Tophub** | API | Free/¥99/mo | Aggregates 50+ platforms | tophub.today |
| Weibo Hot | Official API | Free | Weibo Hot Search |
| Baidu Hot | Crawler/API | Free | Baidu Search Hot |
| Zhihu Hot | Official API | Free | Zhihu Hot Questions |
| Douyin Hot | Non-official | - | Crawler needed |

**Recommendation**: Tophub API (Aggregator).

### 3.3 Industry/Topic Data

| Provider | Product | Data Content | Price |
|-------|------|---------|------|
| **5118** | Big Data API | Keyword heat, long-tail, demand graph | ¥300/month+ |
| Chinaz | API | Keyword data | Free/Paid |
| Baidu Index | Non-official API | Search trends | Crawler needed |
| WeChat Index | Mini-program | WeChat search heat | Manual (Free) |

**Recommendation**: 5118 (Topic mining).

### 3.4 Viral Content Library

| Source | Method | Content | Cost |
|-----|------|------|------|
| Newrank Library | API | Cross-platform viral articles | Included in sub |
| Chanmama Hot | API | Douyin viral videos | Included in sub |
| Self-built Crawler | Scheduled | Cross-platform hot content | Server cost |

---

## 4. Infrastructure

### 4.1 Cloud Server

| Provider | Config | Price | Recommendation |
|-------|---------|------|------|
| **Aliyun** | 2 Core 4G | ¥100/mo+ | Domestic First Choice |
| Tencent Cloud | 2 Core 4G | ¥100/mo+ | Alternative |
| Huawei Cloud | 2 Core 4G | ¥100/mo+ | Alternative |

### 4.2 Database

| Type | Solution | Price | Usage |
|-----|---------|------|------|
| **RDBMS** | Aliyun RDS PostgreSQL | ¥300/mo+ | Primary DB |
| **Cache** | Aliyun Redis | ¥100/mo+ | Cache, Queue |
| **Object Storage** | Aliyun OSS | ¥0.12/GB/mo | Image/Video storage |
| **Search Engine** | Elasticsearch (Aliyun) | ¥500/mo+ | Content Search (Later) |

### 4.3 Other Services

| Service | Recommendation | Price |
|-----|------|------|
| CDN | Aliyun CDN | ¥0.24/GB |
| SMS | Aliyun SMS | ¥0.045/msg |
| Email | SendCloud | ¥0.01/email |
| Payment | WeChat + Alipay | 0.6% rate |
| Domain+SSL | Aliyun | ¥100/year |

---

## 5. Cost Estimation (1000 Paid Users)

### 5.1 API Cost/Month

| Category | Est. Usage | Unit Price | Monthly |
|-----|---------|------|--------|
| Text AI (Qwen) | 5M tokens | ¥0.04/1k | ¥200 |
| Image AI (Wanx) | 10k images | ¥0.06/ea | ¥600 |
| Video AI (Kling) | 1000 mins | ¥8.4/min | ¥8,400 |
| TTS | 5M chars | ¥2/10k | ¥1,000 |
| Moderation | 100k times | ¥0.002/ea | ¥200 |
| **AI Subtotal** | - | - | **¥10,400** |

### 5.2 Data Service Cost/Month

| Service | Monthly |
|-----|------|
| Newrank | ¥3,000 |
| 5118 | ¥300 |
| Tophub | ¥99 |
| **Data Subtotal** | **¥3,400** |

### 5.3 Infrastructure Cost/Month

| Service | Monthly |
|-----|------|
| Cloud Servers (2) | ¥800 |
| RDS | ¥500 |
| Redis | ¥200 |
| OSS (500GB) | ¥100 |
| CDN | ¥300 |
| Other | ¥200 |
| **Infra Subtotal** | **¥2,100** |

### 5.4 Total Monthly Cost

| Category | Cost |
|-----|--------|
| AI Services | ¥10,400 |
| Data Services | ¥3,400 |
| Infrastructure | ¥2,100 |
| **Total Tech Cost** | **¥15,900/month** |

---

## 6. Priority / Roadmap

### Phase 1 (MVP) - Must Have

| Category | Service | Reason |
|-----|------|------|
| Text AI | Qwen-turbo | Cheap & Sufficient |
| Image AI | Wanx (Aliyun) | Best Value |
| Platform API | WeChat OA, Weibo, Toutiao | Official & Stable |
| Hot Data | Tophub | Cheap, Aggregated |
| Database | PostgreSQL + Redis | Standard |

### Phase 2 (V1.0) - Recommended

| Category | Service | Reason |
|-----|------|------|
| Text AI | Upgrade to Qwen-max | Better quality |
| Video AI | Kling AI | Video needs |
| Platform API | Douyin, Xiaohongshu, Bilibili | Core platforms |
| Data Service | Newrank | Viral data support |
| TTS | Aliyun TTS | Video dubbing |

### Phase 3 (V2.0) - Optional

| Category | Service | Reason |
|-----|------|------|
| Text AI | GPT-4o (Advanced) | Differentiation |
| Data Service | Chanmama + Qiangua | Vertical data |
| Topic Tool | 5118 | Blue ocean topics |
| Search | Elasticsearch | Content retrieval |
