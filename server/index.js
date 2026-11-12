const path = require('path')
const fs = require('fs')
const crypto = require('crypto')
const express = require('express')
const cors = require('cors')

const app = express()
const PORT = process.env.PORT || 3001
const DATA_VERSION = '2025'

const LEVELS = ['PROVINCE', 'CITY', 'DISTRICT', 'TOWNSHIP']

app.use(cors())
app.use(express.json())

const regionsPath = path.join(__dirname, 'data', 'regions.json')
const regions = JSON.parse(fs.readFileSync(regionsPath, 'utf8'))

/** code -> { code, name, parentCode, level, children[] } */
const nodeIndex = new Map()

function levelOfCode(code) {
  if (!code) return null
  const len = String(code).length
  if (len === 2) return 'PROVINCE'
  if (len === 4) return 'CITY'
  if (len === 6) return 'DISTRICT'
  if (len === 9) return 'TOWNSHIP'
  return null
}

function indexTree(list, parentCode, level) {
  for (const raw of list) {
    const children = Array.isArray(raw.children) ? raw.children : []
    const node = {
      code: String(raw.code),
      name: raw.name,
      parentCode: parentCode,
      level,
      children
    }
    if (nodeIndex.has(node.code)) {
      const err = new Error(`duplicate code: ${node.code}`)
      err.code = 'BASIC_INVALID_ADMINISTRATIVE_DIVISION'
      throw err
    }
    nodeIndex.set(node.code, node)
    const childLevel = LEVELS[LEVELS.indexOf(level) + 1]
    if (childLevel && children.length) {
      indexTree(children, node.code, childLevel)
    }
  }
}

try {
  indexTree(regions, null, 'PROVINCE')
} catch (e) {
  console.error('Failed to index regions:', e.message)
  process.exit(1)
}

function ok(res, data) {
  res.json({
    code: '0',
    message: 'success',
    data,
    traceId: crypto.randomBytes(8).toString('hex'),
    timestamp: Date.now()
  })
}

function fail(res, status, code, message) {
  res.status(status).json({
    code,
    message,
    data: null,
    traceId: crypto.randomBytes(8).toString('hex'),
    timestamp: Date.now()
  })
}

/** Demo: accept any Bearer token (doc requires login) */
function requireAuth(req, res, next) {
  const header = req.headers.authorization || ''
  if (!/^Bearer\s+\S+/i.test(header)) {
    return fail(res, 401, 'UNAUTHORIZED', '缺少或无效的 Authorization Bearer Token')
  }
  next()
}

function toApiItem(node) {
  const hasChildren = Array.isArray(node.children) && node.children.length > 0
  return {
    code: node.code,
    parentCode: node.parentCode,
    name: node.name,
    level: node.level,
    hasChildren,
    children: []
  }
}

function resolveLabels(codes) {
  return codes.map((code) => {
    const node = nodeIndex.get(String(code))
    return node ? node.name : String(code)
  })
}

/**
 * GET /api/basic/administrative-divisions
 * level 必填；非 PROVINCE 时 code 为直接父级编码
 */
app.get('/api/basic/administrative-divisions', requireAuth, (req, res) => {
  const level = (req.query.level || '').toString().toUpperCase()
  const code = req.query.code != null && req.query.code !== '' ? String(req.query.code) : null

  if (!LEVELS.includes(level)) {
    return fail(
      res,
      400,
      'BASIC_INVALID_ADMINISTRATIVE_DIVISION',
      'level 必填，取值 PROVINCE / CITY / DISTRICT / TOWNSHIP'
    )
  }

  if (level === 'PROVINCE') {
    const items = regions
      .map((raw) => nodeIndex.get(String(raw.code)))
      .filter(Boolean)
      .map(toApiItem)
      .sort((a, b) => a.code.localeCompare(b.code))
    return ok(res, { dataVersion: DATA_VERSION, items })
  }

  if (!code) {
    return fail(
      res,
      400,
      'BASIC_INVALID_ADMINISTRATIVE_DIVISION',
      `查询 ${level} 时 code（父级编码）必填`
    )
  }

  const parent = nodeIndex.get(code)
  if (!parent) {
    return fail(res, 404, 'BASIC_ADMINISTRATIVE_DIVISION_NOT_FOUND', '行政区划不存在')
  }

  const expectedParentLevel = LEVELS[LEVELS.indexOf(level) - 1]
  if (parent.level !== expectedParentLevel) {
    return fail(
      res,
      400,
      'BASIC_INVALID_ADMINISTRATIVE_DIVISION',
      `level=${level} 时 code 应为 ${expectedParentLevel} 编码，当前为 ${parent.level}`
    )
  }

  const items = (parent.children || [])
    .map((raw) => nodeIndex.get(String(raw.code)))
    .filter(Boolean)
    .map(toApiItem)
    .sort((a, b) => a.code.localeCompare(b.code))

  return ok(res, { dataVersion: DATA_VERSION, items })
})

/** ---------- 表单演示用地址存取（非行政区划文档接口） ---------- */
const addressStore = new Map()
let addressSeq = 1

app.post('/api/address', (req, res) => {
  const { id, regionCodes, address } = req.body || {}
  if (!Array.isArray(regionCodes) || regionCodes.length === 0) {
    return fail(res, 400, 'INVALID_PARAM', 'regionCodes required')
  }
  if (typeof address !== 'string' || !address.trim()) {
    return fail(res, 400, 'INVALID_PARAM', 'address required')
  }
  for (const c of regionCodes) {
    if (!nodeIndex.has(String(c))) {
      return fail(res, 404, 'BASIC_ADMINISTRATIVE_DIVISION_NOT_FOUND', `行政区划不存在: ${c}`)
    }
  }

  const record = {
    id: id ? Number(id) : addressSeq++,
    regionCodes: regionCodes.map(String),
    regionLabels: resolveLabels(regionCodes),
    address: address.trim(),
    updatedAt: new Date().toISOString()
  }
  addressStore.set(record.id, record)
  return ok(res, record)
})

app.get('/api/address/:id', (req, res) => {
  const id = Number(req.params.id)
  const record = addressStore.get(id)
  if (!record) {
    return fail(res, 404, 'NOT_FOUND', 'not found')
  }
  return ok(res, record)
})

app.get('/api/address', (req, res) => {
  return ok(res, Array.from(addressStore.values()))
})

const seedCodes = ['33', '3301', '330106']
if (seedCodes.every((c) => nodeIndex.has(c))) {
  addressStore.set(1, {
    id: 1,
    regionCodes: seedCodes,
    regionLabels: resolveLabels(seedCodes),
    address: '文三路 100 号',
    updatedAt: new Date().toISOString()
  })
  addressSeq = 2
}

/** ---------- 多选下拉：分页 options + 批量 ID 回显 ---------- */
const OPTION_TOTAL = 200
const optionCatalog = Array.from({ length: OPTION_TOTAL }, (_, i) => {
  const id = i + 1
  return {
    id,
    label: `选项 ${String(id).padStart(3, '0')}`,
    code: `OPT-${String(id).padStart(3, '0')}`
  }
})
const optionIndex = new Map(optionCatalog.map((item) => [item.id, item]))

const selectionStore = new Map()
let selectionSeq = 1

/**
 * 分页列表 + 远程搜索
 * GET /api/options?keyword=&page=1&pageSize=20
 */
app.get('/api/options', (req, res) => {
  const keyword = (req.query.keyword || '').toString().trim().toLowerCase()
  const page = Math.max(1, Number(req.query.page) || 1)
  const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize) || 20))

  let filtered = optionCatalog
  if (keyword) {
    filtered = optionCatalog.filter(
      (item) =>
        item.label.toLowerCase().includes(keyword) ||
        item.code.toLowerCase().includes(keyword) ||
        String(item.id).includes(keyword)
    )
  }

  const total = filtered.length
  const start = (page - 1) * pageSize
  const list = filtered.slice(start, start + pageSize)

  return ok(res, {
    list,
    total,
    page,
    pageSize,
    hasMore: start + list.length < total
  })
})

/**
 * 批量按 ID 查询（回显专用）
 * POST /api/options/batch  body: { ids: number[] }
 */
app.post('/api/options/batch', (req, res) => {
  const ids = Array.isArray(req.body && req.body.ids) ? req.body.ids : []
  if (!ids.length) {
    return fail(res, 400, 'INVALID_PARAM', 'ids required')
  }

  const list = []
  const missing = []
  for (const raw of ids) {
    const id = Number(raw)
    const item = optionIndex.get(id)
    if (item) list.push(item)
    else missing.push(raw)
  }

  return ok(res, { list, missing })
})

/** 保存多选表单（只存 ids） */
app.post('/api/selections', (req, res) => {
  const { id, optionIds, remark } = req.body || {}
  if (!Array.isArray(optionIds) || optionIds.length === 0) {
    return fail(res, 400, 'INVALID_PARAM', 'optionIds required')
  }

  const normalized = optionIds.map(Number)
  for (const oid of normalized) {
    if (!optionIndex.has(oid)) {
      return fail(res, 404, 'OPTION_NOT_FOUND', `选项不存在: ${oid}`)
    }
  }

  const record = {
    id: id ? Number(id) : selectionSeq++,
    optionIds: normalized,
    optionLabels: normalized.map((oid) => optionIndex.get(oid).label),
    remark: typeof remark === 'string' ? remark.trim() : '',
    updatedAt: new Date().toISOString()
  }
  selectionStore.set(record.id, record)
  return ok(res, record)
})

app.get('/api/selections/:id', (req, res) => {
  const id = Number(req.params.id)
  const record = selectionStore.get(id)
  if (!record) return fail(res, 404, 'NOT_FOUND', 'not found')
  return ok(res, record)
})

app.get('/api/selections', (req, res) => {
  return ok(res, Array.from(selectionStore.values()))
})

/** 种子：选中靠后的 id，故意不在首屏 20 条里，验证回显合并 */
selectionStore.set(1, {
  id: 1,
  optionIds: [88, 120, 199],
  optionLabels: [88, 120, 199].map((oid) => optionIndex.get(oid).label),
  remark: '回显示例：这些 id 不在第一页 options 中',
  updatedAt: new Date().toISOString()
})
selectionSeq = 2

app.listen(PORT, () => {
  console.log(`LIMS mock API on http://localhost:${PORT}`)
  console.log(`Divisions: GET /api/basic/administrative-divisions?level=PROVINCE`)
  console.log(`Options: GET /api/options?page=1&pageSize=20  |  POST /api/options/batch`)
  console.log(`Indexed nodes: ${nodeIndex.size}, dataVersion=${DATA_VERSION}`)
  if (addressStore.has(1)) {
    const seed = addressStore.get(1)
    console.log(`Seed address id=1: ${seed.regionLabels.join(' / ')} ${seed.address}`)
  }
  console.log(`Seed selection id=1: optionIds=${selectionStore.get(1).optionIds.join(',')}`)
})
