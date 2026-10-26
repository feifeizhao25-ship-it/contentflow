/**
 * 本地热点样例。只返回一条写明来源和时间的话题，不代替未配置时的空状态。
 * 用法：node e2e/hot-mock.mjs
 */
import http from 'node:http';

const port = Number(process.env.HOT_MOCK_PORT || 4019);
const server = http.createServer((req, res) => {
  const fetchedAt = '2026-10-23T08:30:00.000Z';
  const body = {
    fetchedAt,
    topics: [
      {
        id: 'local-1',
        topic: '秋天的读书笔记怎么写',
        heat: 128000,
        platform: 'xhs',
        fetchedAt,
        source: '本地热点样例',
      },
    ],
  };
  res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
});
server.listen(port, '127.0.0.1', () => {
  process.stdout.write(`hot-mock listening on ${port}\n`);
});
