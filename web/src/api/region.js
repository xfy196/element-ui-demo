import axios from 'axios'

const LEVELS = ['PROVINCE', 'CITY', 'DISTRICT', 'TOWNSHIP']

const http = axios.create({
  baseURL: '/api',
  timeout: 15000
})

// 文档要求 Authorization: Bearer <access-token>
http.interceptors.request.use((config) => {
  if (!config.headers.Authorization) {
    config.headers.Authorization = 'Bearer demo-token'
  }
  return config
})

/**
 * 按需查询行政区划（对齐文档）
 * @param {'PROVINCE'|'CITY'|'DISTRICT'|'TOWNSHIP'} level
 * @param {string} [parentCode] 非 PROVINCE 时必填
 */
export function fetchAdministrativeDivisions(level, parentCode) {
  const params = { level }
  if (level !== 'PROVINCE') {
    params.code = parentCode
  }
  return http
    .get('/basic/administrative-divisions', { params })
    .then((res) => res.data.data)
}

/** 懒加载：按 cascader 节点层级拉直接子节点 */
export function fetchRegionChildrenByCascaderLevel(cascaderLevel, parentCode) {
  const level = LEVELS[cascaderLevel]
  if (!level) return Promise.resolve([])
  return fetchAdministrativeDivisions(level, parentCode).then((data) => data.items || [])
}

/**
 * 文档无 path 接口：前端按已存 codes 逐层请求，拼出回显用 options
 */
export async function buildRegionPathOptions(codes) {
  if (!Array.isArray(codes) || !codes.length) {
    return { codes: [], labels: [], options: [] }
  }

  const levelItemsList = []
  const labels = []

  for (let i = 0; i < codes.length; i++) {
    const level = LEVELS[i]
    if (!level) break
    const parentCode = i === 0 ? undefined : codes[i - 1]
    const data = await fetchAdministrativeDivisions(level, parentCode)
    const items = data.items || []
    levelItemsList.push(items)
    const selected = items.find((item) => item.code === String(codes[i]))
    labels.push(selected ? selected.name : String(codes[i]))
  }

  function buildTree(depth) {
    const items = levelItemsList[depth] || []
    return items.map((item) => {
      const opt = {
        value: item.code,
        label: item.name,
        leaf: !item.hasChildren
      }
      if (
        item.code === String(codes[depth]) &&
        depth < codes.length - 1 &&
        levelItemsList[depth + 1]
      ) {
        opt.children = buildTree(depth + 1)
        opt.leaf = false
      }
      return opt
    })
  }

  return {
    codes: codes.map(String),
    labels,
    options: buildTree(0)
  }
}

export function getAddress(id) {
  return http.get(`/address/${id}`).then((res) => res.data.data)
}

export function saveAddress(payload) {
  return http.post('/address', payload).then((res) => res.data.data)
}

export function listAddresses() {
  return http.get('/address').then((res) => res.data.data)
}
