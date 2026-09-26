# JOBGET Backend v2.7.0

文档入口：[docs/README.md](docs/README.md)。运行配置与单安装实例额度见 [docs/configuration.md](docs/configuration.md)。

本地链路：Chrome/Edge 扩展 → `http://localhost:8787` → Cloudflare Worker → 兼容 Responses 的模型服务；匿名统计写本地 D1。当前未部署公网。

## 背景与项目定位

本项目为 JOBGET 求职辅助浏览器扩展提供托管 AI 入口与匿名使用统计。扩展负责岗位、简历等业务交互与结果解析；后端统一管理模型配置和密钥、限制调用额度，并通过 Cloudflare D1 保存不含业务正文的指标。

## 项目说明与功能实现

从 [项目说明](docs/project.md) 开始阅读，包含背景、系统分工、目录导航、配置以及各项功能的实现流程。

- **托管 AI**：参数校验、模块输出预算、原子额度预占、模型转发与用量统计。
- **匿名事件**：批量校验、重复/冲突事件处理，以及数据库触发器维护日汇总。
- **基础能力**：跨域与路由、请求体限长、健康响应及 30 天明细清理。

调用次数可通过 `AI_QUOTA_DISABLED` 控制：当前代码默认不限次数，模板环境变量为 `false`（启用限额），环境变量优先。详见 [配置说明](docs/configuration.md)。

代码入口为 `src/index.js`，核心流程分别在 `src/ai-gateway.js` 和 `src/events.js`。

## 启动

```bash
npm ci
test -f .dev.vars || cp .dev.vars.example .dev.vars
# 编辑 .dev.vars，填写 AI_API_KEY；已有文件请保留，不要覆盖。
# wrangler.jsonc 的 AI_API_URL / AI_MODEL 必须与密钥对应的服务兼容。
npx wrangler d1 execute jobget-metrics --local --file=sql/schema.sql
npx wrangler d1 execute jobget-metrics --local --file=sql/event-aggregates.sql
npm run dev
```

访问 `http://localhost:8787/health` 应返回 `status: ok`；这只说明 Worker 可访问，不检查密钥、上游模型或 D1。扩展选择“JOBGET 托管服务”，点击连接测试才会验证模型链路并消耗一次额度。仓库不含真实密钥，不能开箱完成真实 AI 推理。

旧库升级顺序见 [本地部署与排障](docs/deployment.md)。事件触发器不可漏装，否则统计汇总不会更新。

## 接口与验证

- [完整接口说明](docs/api.md)：请求字段、响应、错误码、模块预算、额度、CORS、重试及 curl 示例。
- [检查记录](docs/verification.md)：本次验证范围及尚需人工验收的事项。
- `npm test` / `npm run test:worker` 是同一套 Vitest Worker + D1 测试，模型请求使用 mock。
- `test/contract.spec.js` 会导入相邻的 `../JDGET_v2.7.0` 插件真实客户端；两个仓库需按此目录并列。单独后端可用 `npx vitest run test/index.spec.js`。

没有公开统计查询 API。维护者执行：

```bash
# 执行 SQL 查询（本地数据库）
npx wrangler d1 execute jobget-metrics --local --command="SELECT * FROM ai_calls ORDER BY rowid DESC LIMIT 20;"

# 查看所有表
npx wrangler d1 execute jobget-metrics --local --command="SELECT name FROM sqlite_master WHERE type='table';"

# 执行 SQL 文件
npx wrangler d1 execute jobget-metrics --local --file=sql/report.sql
```
