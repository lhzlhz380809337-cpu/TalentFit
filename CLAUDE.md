# TalentFit · 本地人岗匹配

全局规范参见 `../../CLAUDE.md` 和 `../../.claude/DEVELOPMENT_GUIDE.md`（若存在）。

本项目是 Windows 单人本地便携工具。以轻量和双击即用为优先，不引入 Electron、Node 服务运行时或 ORM。

- 后端：`app/server.py`，Python 标准库 HTTP / SQLite；唯一第三方运行依赖为 pypdf。
- 前端：`src`，React / TypeScript / Vite，编译至 `dist`。开发依赖不随发行包分发。
- 启动：`desktop/TalentFitLauncher.cs`，复用系统 Edge / Chrome，托盘退出、单实例、端口回退。
- 数据：`data/talentfit.db`，不可清理或放入发行包。`.env` 和运行日志也不可分发。
- 功能：JD 固定目标与权重、PDF/DOCX/TXT 批量上传、失败重试去重、事务保存、同岗位 2–4 人比较。
- 评分：按岗位目标达标率计算；读取报告不得隐式触发 AI；软性维度和低置信度证据须提示面试核实。

命令与重建步骤见 README。`npm test` 验证后端；`npm run test:ui` 验证界面；`npm run package:windows` 生成便携 ZIP 后运行 `npm run test:launcher`。
