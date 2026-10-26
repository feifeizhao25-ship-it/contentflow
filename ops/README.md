# 艾瑞见时运营中枢

这是 OpenClaw 在一台常驻服务器上跑的运营程序，同时服务顺时、见己、分发侠。它不引用任何产品代码。产品需要数据时走 HTTP。以后可以把整个 `ops/` 目录拆成独立仓库。

人只在企业微信里点同意或拒绝。群机器人只发通知，不能当作审批。

## 安装

需要 Python 3.11 及以上。

```bash
cd ops
python3 -m pip install -r requirements.txt
```

命令入口：

```bash
PYTHONPATH=. python3 -m airui_ops --help
# 或者
./bin/ops --help
```

## 配置

1. 复制 `config/airui-growth.example.yaml`，放到服务器上，例如 `/etc/airui-growth/airui-growth.yaml`。文件里只有占位符，不要写密钥。
2. 密钥放在另一个文件，权限必须是 `600`，属主必须是运行这个程序的账户。权限不对时，程序不读文件内容，相关模块保持关闭。

```bash
install -m 600 /dev/null /etc/airui-growth/secrets.env
```

每一行是 `变量名=值`。下面只列变量名，不要把真实值写进仓库、日志或聊天记录。

OpenClaw 主机（与分发侠产品服务器的密钥分开）：

- 审批：`WECOM_SECRET`、`WECOM_TOKEN`、`WECOM_AES_KEY`
- 通知：`WECOM_WEBHOOK_KEY`
- 模型：`DEEPSEEK_API_KEY`、`DASHSCOPE_API_KEY`、`ARK_API_KEY`
- 可灵（可选，基址未填时不调用）：`KLING_ACCESS_KEY`、`KLING_SECRET_KEY`
- 发布：`BAIDU_PUSH_TOKEN`、`OPENCLAW_SHUNSHI_ADMIN_TOKEN`、`OPENCLAW_FENFAXIA_API_TOKEN`
- 发布包签名：`PKG_PREVIEW_SIGNING_KEY`（至少 32 位）
- 可选：`GROWTHBOOK_CLIENT_KEY`、`UMAMI_API_TOKEN`、`OPENCLAW_GITHUB_TOKEN`、`WECHAT_MP_APPSECRET_SHUNSHI`、`WECHAT_MP_APPSECRET_FENFAXIA`、`DOUYIN_CLIENT_KEY`、`DOUYIN_CLIENT_SECRET`

`FAL_KEY`、`FAL_API_KEY`、`OPENROUTER_API_KEY` 以及任何 `FAL_` / `OPENROUTER` 变量会被忽略，不参与调用。

分发侠产品服务器另用一套名字：`FENFAXIA_DEEPSEEK_API_KEY`、`FENFAXIA_DASHSCOPE_API_KEY`、`FENFAXIA_ARK_API_KEY`、`FENFAXIA_KLING_ACCESS_KEY`、`FENFAXIA_KLING_SECRET_KEY`。旧的 `DEEPSEEK_API_KEY`、`QWEN_API_KEY`、`DASHSCOPE_API_KEY` 仍可作为别名。国际版（`MARKET_REGION` 不是国内）仍可使用原来的境外图片通道；国内版会清空那把密钥。

## 命令

```bash
ops --config /etc/airui-growth/airui-growth.yaml --secrets /etc/airui-growth/secrets.env --data /var/lib/airui-growth preflight
ops ... preflight --report wecom    # 把自检摘要发到企业微信群，群消息不是审批
ops ... preflight --report json
ops ... status
ops ... reconcile                   # 每 15 分钟补拉审批单
ops ... run daily
ops ... serve --host 127.0.0.1 --port 8080
```

也可以用环境变量 `AIRUI_CONFIG`、`AIRUI_SECRETS_FILE`、`AIRUI_DATA_DIR`。

`serve` 提供：

- `GET /health`、`GET /status`
- `GET/POST /wecom/callback`：校验签名并解密。签名不对返回 403，不改任何审批状态
- `GET /pkg/{id}?exp=&sig=`：手机上的一键发布包
- `POST /pkg/{id}/published`：人填写已发布的链接，只记录，不回访该链接

## 审批

主路径是企业微信自建应用的 OA 审批：`applyevent` 提交，`sys_approval_change` 回调，动作前再用 `getapprovaldetail` 复核。每 15 分钟用 `getapprovalinfo` 对账，防止漏回调。

模板卡片按钮只允许单人审批的事项。需要两个人的事项（商务、开关、事故）不能走卡片。

每条审批绑定内容的 `content_sha256`。内容一改，原来的同意作废。超时等于没同意。企业微信连不上时，不发布，也不改开关。

开关在 YAML 里写成开，也不会生效，除非已有一份同意记录，且记录里的配置哈希等于当前文件的哈希。默认全关。

## 发布档位

- A 档可以自动发：官网 / SEO、分发侠模板页、百度普通收录、已订阅用户的站内卡片 / 推送 / 邮件。产品接口还没接上的通道会打上 stub，即使 HTTP 返回 200 也不算已发布。
- B 档只生成手机发布包：小红书、公众号、视频号、知乎、抖音、B 站。程序不登录、不代发。人复制正文、下载素材、自己发出去，再点「已发布」并交回链接。
- C 档是见己。四道门（法务签署、年龄门槛、心理审核签署、重新同意）全部为真之前，禁止任何发布。

自动发布还要同时满足：需要审批的内容有匹配哈希的同意记录、当前时间在上海时区 08:00–21:30、已加上 AIGC 标识、审计日志只追加。

急停：正文或回调里出现「停止所有操作」「急停」「PAUSE」，或设置 `AIRUI_KILL_SWITCH`，或数据目录里有急停文件。急停后全部停下。事故单同意只会清掉急停文件，清不掉环境变量。

## 自检

每次运行检查配置表里的必填项，以及上面列出的密钥是否存在、格式是否合格。报告里只有变量名和「有 / 没有」。缺一项就关掉对应模块，其他模块继续。见己四道门没齐时，见己发布保持关闭。

## 联调前还要准备的真实凭据

- 企业微信自建应用的 corpid、agentid、secret、回调 token、EncodingAESKey，以及审批模板 ID（`WECOM_TPL_CONTENT`、`WECOM_TPL_BUSINESS`、`WECOM_TPL_COMPLIANCE`、`WECOM_TPL_PROMOTION`、`WECOM_TPL_SWITCH`、`WECOM_TPL_INCIDENT`）和模板里的控件 ID
- 群机器人 webhook key（只做通知）
- DeepSeek、百炼、方舟三把 OpenClaw 密钥，以及分发侠产品服务器上的 `FENFAXIA_*` 密钥
- `PKG_PREVIEW_SIGNING_KEY`、`BAIDU_PUSH_TOKEN`
- 顺时、分发侠给 OpenClaw 的管理令牌，以及各产品真实的 HTTP 基址

## 这次没有在真实环境核对的部分

- 可灵 API 基址和鉴权方式。基址留空。填上之后，主机名还必须落在境内后缀（如 `klingai.com`）里才会发送；鉴权按 Bearer 发送 access key，这是占位，不是已核对的官方签名。
- 阿里云内容安全护栏的具体端点。留空时只跑本地词表，并标明待核实。
- 百度普通收录没有试运行接口，自检只查 token 格式。
- 文档 12 的营销名 `qwen-image` 与官方现行 ID `qwen-image-2.0` 不一致，调用使用官方 ID，可用配置覆盖。
- DeepSeek 定价页与文档 12 的数字不一致。产品侧价目仍按已经锁定的高峰价；运营中枢按文档 12 的基准价，高峰加倍。
- 豆包、Seedance、可灵、万相、CosyVoice 的备案号，以及 CosyVoice 预置音色 ID。音色 ID 为空时不合成语音。
- 顺时 / 分发侠的站内卡片、订阅推送、小程序订阅消息、邮件、企微社群广播接口。代码里是 stub，返回 200 也不会记成已发布。
- 企业微信审批模板的控件 ID 需要在管理后台建好模板后回填。
- DeepSeek 高峰价是否因法定节假日减免。这里没有假日表，工作日时段一律按高峰计。
- 国际版的 FAL / OpenRouter 路径保留给非国内市场。国内版不会走它们。
- GitHub Actions 没有可用的 runner。测试在开发机本地跑，见拉取请求说明。
