# TalentFit · 本地人岗匹配工作台

双击启动，建立岗位、批量上传简历、按岗位目标匹配，再横向比较候选人的证据与待追问事项。深蓝工作台布局，候选人列表与处理状态集中展示。

## 日常使用

已构建的本地版本可双击根目录 **TalentFit.exe**；便携包位于 **release/TalentFit-Windows-x64.zip**，完整解压后双击其中的启动器。GitHub 仓库提供源码，需要按下文步骤构建；便携包是否已发布可查看 [GitHub Releases](https://github.com/lhzlhz380809337-cpu/TalentFit/releases)。

- 便携包约 **12.29 MiB**，解压约 **24.23 MiB**。内置 Python，无需安装 Node.js、Python 或 npm。
- Windows 10 / 11 x64，通过本机 Edge / Chrome 打开独立窗口；找不到时使用默认浏览器。
- 只监听本机，自动等待服务就绪、避开占用端口，重复双击复用已有后台。
- 关闭窗口后服务留在系统托盘；右键托盘图标选择「退出 TalentFit」结束运行。
- 首次进入「模型设置」，填写接口地址、模型名称和 API Key，保存并测试连接。AI 分析需要可用的联网模型服务。

## 工作流

1. 新建岗位并粘贴 JD，生成固定的能力目标与权重。
2. 一次选择或拖入多份 **PDF / DOCX / TXT**，也可以粘贴简历文字。
3. 最多同时处理两份，自动解析和评分；每份独立显示状态和错误。
4. 失败任务可以单独重试；评分重试复用候选人，同岗位相同正文也会复用已有记录。
5. 搜索、筛选、排序候选人，勾选同岗位 **2–4 人**进入比较。
6. 查看达标率、维度对比、原文证据、优势、待核实项和面试问题；支持多候选人雷达图、CSV 导出和单人报告打印。

每份文件最大 10 MB。支持文字型 PDF、DOCX，以及 UTF-8、UTF-16、GB18030 TXT。扫描 PDF 请先 OCR；旧版 `.doc` 请另存为 `.docx`。损坏文件、格式不支持、内容过短和超限都有错误提示。

处理时保持窗口打开。应用内切换页面会保留队列；刷新或退出会丢失尚未提交的文件任务。已保存的候选人和报告仍在，待评分候选人可从列表继续匹配。

## 评分与数据

`岗位达标率 = Σ [权重 × min(候选人等级 / 岗位目标等级, 1)] / Σ 权重 × 100%`

同岗位所有人使用固定目标与权重。达到目标即为 100%；超出一项不能抵消另一项缺口。低置信度与无法仅凭简历验证的能力标为待核实。列表、报告和比较页使用同一口径。评分、面试问题和报告在一个数据库事务中保存，失败保留之前的完整结果。读取报告不重新调用 AI。

数据位于 **data/talentfit.db**，包含简历、报告与模型配置。退出程序后复制整个 `data` 文件夹备份。更新时保留 `data`，替换 `app`、`python`、`dist` 和 `TalentFit.exe`。日志位于 `logs/server.log`。

发行 ZIP 使用文件白名单，不包含 `.env`、用户数据库、简历或运行日志。首次启动自动建立数据库及七个默认维度。模型密钥保存在本机数据库中，不写入新的 AI 调用日志。不要把使用后的 `data` 和 `logs` 随软件分发。

这是单人本地工具；分析用于人工比较及面试准备，最终判断由招聘人员作出。

## 轻量化方案

后台使用 Python 标准库的 HTTP、SQLite、ZIP/XML、网络请求，仅 PDF 解析依赖 pypdf。Windows 启动器使用系统 .NET Framework，界面复用本机浏览器。React 前端在开发时编译，日常仅加载约 0.5 MiB 的静态文件。

已移除 Express、Prisma、Node 运行时、mammoth、pdf-parse、云部署配置及旧版重复实现。发布不包含 `node_modules`、构建缓存或开发工具；不需要另装浏览器引擎。

## 开发与重新打包

源码保留以便修改，开发前端时才需要 Node.js 22.3+。克隆后执行：

```powershell
npm ci
npm run setup:runtime
npm run build
npm start
```

`setup:runtime` 从 Python 官方下载固定版本的 Windows 嵌入版，从 PyPI 下载固定版本 pypdf，校验 SHA-256。开发后端默认端口 17840；另开终端 `npm run dev` 启动端口 5174 的前端热更新。默认开发数据也在 `data`；需要隔离时，在运行后端前设置 `$env:TF_DATA_PATH` 指向测试数据库。

```powershell
npm run check
npm run lint
npm test
npm run test:ui
npm run package:windows
npm run test:launcher
```

- 后端测试：真实 PDF / DOCX / TXT、并发上传、重试去重、岗位归属、事务回滚、报告读取、评分规则和配置保存。使用临时数据库及本地模拟模型，不调用付费接口。
- 界面测试：本机 Edge 无头测试批量选择、失败重试、页面切换、比较与导出、报告读取、窄屏布局；截图输出到 `build/screenshots`。
- 启动测试：从发行 ZIP 解压，在中文和空格路径、空 PATH、默认端口占用情况下验证启动、数据库、重复启动与退出。
- 打包：生成根目录 `TalentFit.exe` 与发行 ZIP，不生成另一套解压副本。仅修改 Python 后端时可直接运行 `desktop/package.ps1`，无需重新构建前端。

完成开发后可运行 `powershell.exe -NoProfile -ExecutionPolicy Bypass -File desktop/cleanup-development.ps1`，删除旧 Node 运行环境、`node_modules`、构建缓存和旧版解压副本。日常启动不依赖这些目录。脚本保留 `python`、`app`、`dist`、`TalentFit.exe`、新发行 ZIP 及用户数据；旧发行副本若含用户数据会停止清理。开发依赖可用 `npm ci` 重建。实际模型服务需在设置页自行测试连接。

## 目录

| 路径 | 用途 |
|---|---|
| `app` | 标准库后端、PDF/Word 解析、评分和默认维度 |
| `python` | 内置便携运行环境，自动下载，不提交 Git |
| `src` / `shared` | 界面源码与类型 |
| `dist` | 编译好的静态界面 |
| `desktop` | 启动器、运行环境准备、打包及使用说明 |
| `scripts` / `tests` | 打包和回归验证 |
| `release` | 便携 ZIP |

许可证：MIT。Python 及 pypdf 的许可证保留在其发行文件中。
