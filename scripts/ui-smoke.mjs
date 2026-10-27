import { chromium } from '@playwright/test'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { readFile, mkdir } from 'node:fs/promises'
import path from 'node:path'

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost')
    const filename = url.pathname.startsWith('/assets/') ? path.join('dist', url.pathname) : 'dist/index.html'
    res.setHeader('Content-Type', filename.endsWith('.js') ? 'text/javascript' : filename.endsWith('.css') ? 'text/css' : 'text/html')
    res.end(await readFile(filename))
  } catch { res.writeHead(404); res.end() }
})
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
const base = `http://127.0.0.1:${server.address().port}`
const browser = await chromium.launch({ channel: 'msedge', headless: true })
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 })
const errors = []
page.on('pageerror', error => errors.push(error.message))
const names = ['陈思远', '林知夏']
const dims = ['专业知识', '问题解决', '数据分析', '跨部门沟通', '执行力', '学习敏锐度', '团队协作']
const reports = names.map((candidateName, i) => ({
  candidateName, jobTitle: '高级工艺工程师', overallMatch: i === 0 ? 94 : 87, pjMatch: 93, poMatch: 88,
  dimensionScores: dims.map((dimensionName, j) => ({ dimensionId: `d${j}`, dimensionName, candidateLevel: j === i ? 5 : j === 3 ? 2 : 3, requiredLevel: 3, weight: 1 / 7, verifiable: j < 5, confidence: j < 5 ? 'high' : 'low', evidence: '项目经历原文：独立负责工艺改进项目，组织跨部门分析，将产品良率提升至 98%。', candidateLevelReason: '有独立推进项目的经历，能够运用相关方法解决实际问题。复杂场景与长期成果仍需面试核实。', requiredLevelReason: '岗位要求独立负责项目' })),
  gaps: [], risks: [], interviewQuestions: [{ dimensionId: 'd3', dimensionName: '跨部门沟通', gapType: 'low_score', question: '请介绍一次跨部门资源冲突，以及你的协调行动和结果。', whatToListenFor: '具体措施和量化成果' }], disclaimer: '仅供参考',
}))
const candidates = []
let uploads = 0; let scores = 0; let failedOnce = false
await page.route('**/api/**', async route => {
  const req = route.request(); const url = new URL(req.url()); let data
  const ok = data => route.fulfill({ json: { success: true, data } })
  if (url.pathname === '/api/jobs') return ok([{ id: 'job1', title: '高级工艺工程师', jobFamily: 'technical', candidateCount: candidates.length, createdAt: new Date().toISOString() }])
  if (url.pathname === '/api/jobs/job1') return ok({ id: 'job1', title: '高级工艺工程师', rawText: '负责工艺开发、良率改善和跨部门项目推进。', requirements: dims.slice(0, 5).map(mappedDimension => ({ mappedDimension, targetLevel: 3, priority: 'must_have', description: `具备独立负责${mappedDimension}相关项目的能力，能够提供具体成果。` })) })
  if (url.pathname.endsWith('/candidates') && req.method() === 'POST') {
    const i = uploads++; candidates.push({ id: `c${i}`, name: names[i], matchScore: null, status: 'pending', createdAt: new Date().toISOString() })
    return ok({ id: `c${i}`, name: names[i] })
  }
  if (url.pathname.endsWith('/candidates')) return ok(candidates)
  if (url.pathname.endsWith('/score')) {
    scores++; const i = url.pathname.includes('/c0/') ? 0 : 1
    await new Promise(resolve => setTimeout(resolve, 250))
    if (i === 0 && !failedOnce) { failedOnce = true; return route.fulfill({ status: 500, json: { success: false, error: '模拟连接中断，请重试评分' } }) }
    candidates[i].matchScore = reports[i].overallMatch
    return ok(reports[i])
  }
  if (url.pathname.endsWith('/report')) return ok(reports[url.pathname.includes('/c0/') ? 0 : 1])
  if (url.pathname === '/api/settings') return ok([])
  return ok(data || [])
})
try {
  await mkdir('build/screenshots', { recursive: true })
  await page.goto(base)
  await page.getByRole('button', { name: /高级工艺工程师/ }).click()
  await page.getByLabel('选择简历文件').setInputFiles([
    { name: '陈思远.pdf', mimeType: 'application/pdf', buffer: Buffer.from('synthetic PDF upload') },
    { name: '林知夏.docx', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', buffer: Buffer.from('synthetic DOCX upload') },
  ])
  await page.getByRole('button', { name: '重试评分' }).waitFor()
  // Navigation must preserve the queue and the parsed candidate ID.
  await page.getByRole('link', { name: '模型设置', exact: true }).click()
  await page.getByRole('link', { name: '招聘工作台', exact: true }).click()
  await page.getByRole('button', { name: /高级工艺工程师/ }).click()
  await page.getByRole('button', { name: '重试评分' }).click()
  await page.getByText('2 / 2', { exact: true }).waitFor()
  assert.equal(uploads, 2, 'retry must not upload again')
  assert.equal(scores, 3)
  await page.getByLabel('选择 陈思远 进行比较').check()
  await page.getByLabel('选择 林知夏 进行比较').check()
  await page.screenshot({ path: 'build/screenshots/workspace.png', fullPage: true })
  await page.getByRole('link', { name: '横向比较' }).click()
  await page.getByRole('heading', { name: '候选人比较' }).waitFor()
  await page.getByRole('button', { name: '导出比较表' }).waitFor()
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: '导出比较表' }).click()
  assert.equal((await download).suggestedFilename(), '候选人比较.csv')
  await page.screenshot({ path: 'build/screenshots/compare.png', fullPage: true })
  await page.getByRole('link', { name: '查看完整报告' }).first().click()
  await page.getByText('岗位达标率', { exact: true }).waitFor()
  await page.screenshot({ path: 'build/screenshots/report.png', fullPage: true })
  assert.equal(scores, 3, 'reading reports must not trigger scoring')
  await page.goto(base + '/jobs/job1')
  await page.setViewportSize({ width: 390, height: 844 })
  await page.getByRole('heading', { name: '一次放入多份简历' }).waitFor()
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'mobile page should not overflow')
  await page.screenshot({ path: 'build/screenshots/mobile.png', fullPage: true })
  await page.route('**/api/settings', route => route.fulfill({ status: 500, json: { success: false, error: '设置读取失败，请刷新页面重试。' } }))
  await page.goto(base + '/settings')
  await page.getByText('设置读取失败，请刷新页面重试。', { exact: true }).waitFor()
  assert.ok(await page.getByRole('button', { name: '保存设置' }).isDisabled(), 'failed load must not overwrite existing configuration')
  await page.getByText('连接失败', { exact: true }).waitFor()
  await page.route('**/api/audit-logs?*', route => route.fulfill({ status: 500, json: { success: false, error: '日志读取失败，请重试。' } }))
  await page.goto(base + '/audit')
  await page.getByRole('alert').filter({ hasText: '日志读取失败，请重试。' }).waitFor()
  assert.deepEqual(errors, [])
  console.log('PASS: multiple file selection, per-task retry without duplicate upload, navigation persistence, comparison, CSV export, report read-only, mobile layout, no browser errors.')
} finally { await browser.close(); await new Promise(resolve => server.close(resolve)) }
