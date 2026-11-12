import axios from 'axios'

const http = axios.create({
  baseURL: '/api',
  timeout: 15000
})

/**
 * 分页 + 远程搜索
 * @returns {{ list, total, page, pageSize, hasMore }}
 */
export function fetchOptions({ keyword = '', page = 1, pageSize = 20 } = {}) {
  return http
    .get('/options', { params: { keyword, page, pageSize } })
    .then((res) => res.data.data)
}

/** 批量 ID 查询（回显） */
export function fetchOptionsByIds(ids) {
  return http.post('/options/batch', { ids }).then((res) => res.data.data)
}

/**
 * 合并已选与分页列表：已选优先靠前，按 id 去重
 */
export function mergeOptions(selectedList, pageList) {
  const map = new Map()
  ;[...(selectedList || []), ...(pageList || [])].forEach((item) => {
    if (item && item.id != null && !map.has(item.id)) {
      map.set(item.id, item)
    }
  })
  return Array.from(map.values())
}

export function getSelection(id) {
  return http.get(`/selections/${id}`).then((res) => res.data.data)
}

export function saveSelection(payload) {
  return http.post('/selections', payload).then((res) => res.data.data)
}

export function listSelections() {
  return http.get('/selections').then((res) => res.data.data)
}
