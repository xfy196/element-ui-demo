# Vue2 Cascader 懒加载省市区回显 Demo

前端：Vue 2.7 + Element UI  
后端：Express 模拟 `gongcelian-lims-service` 行政区划接口  
数据：本地 `server/data/regions.json`（modood `pca-code.json`，省/市/区三级；乡镇层接口可用，当前数据无街道节点）

## 行政区划接口（对齐设计文档 V1.0）

```http
GET /api/basic/administrative-divisions?level=PROVINCE
GET /api/basic/administrative-divisions?level=CITY&code=33
GET /api/basic/administrative-divisions?level=DISTRICT&code=3301
Authorization: Bearer <access-token>
```

- `level` 必填：`PROVINCE` | `CITY` | `DISTRICT` | `TOWNSHIP`
- 非省级时 `code` 为直接父级编码
- 响应：`code/message/data/traceId/timestamp`；`data.items[].children` 固定 `[]`，靠 `hasChildren` 继续懒加载

## 回显解法

文档只有按需查询接口，**无 path 接口**。前端按已存 `regionCodes` 逐层请求，拼出 cascader `options`，再赋 `v-model`：

1. `GET /api/address/:id` → `regionCodes` + `address`
2. 依次：`PROVINCE` → `CITY&code=省` → `DISTRICT&code=市`（…）
3. 客户端拼 siblings 路径树 → 设 `options` → `$nextTick` 后设 `regionCodes`

## 启动

```bash
cd server && npm install && npm start
cd web && npm install && npm run dev
```

- API: http://localhost:3001  
- 页面: http://localhost:5173  

示例 `id=1`：浙江省 / 杭州市 / 西湖区。

## 其它演示接口

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/address` | 保存（`regionCodes` + `address`） |
| GET | `/api/address/:id` | 读取 |
| GET | `/api/address` | 列表 |

## 多选下拉（分页 + 远程搜索 + 回显合并）

列表每次只返回 20 条时，已选 id 往往不在当前 options 中，标签会空白。

**解法：**

1. `GET /api/options?keyword=&page=1&pageSize=20` — 分页 / 远程搜索（页面侧）  
2. `POST /api/options/batch` body `{ ids: [88,120,199] }` — 回显批量查已选项  
3. 页面侧 `mergeOptions(已选, 分页)` 后再赋 `v-model`  
4. [`ElSelectLoadmore`](web/src/components/ElSelectLoadmore.vue) 只抛 `remote-search` / `load-more`，**不内置 page/pageSize/请求**

示例 `selection id=1` 已选 `88,120,199`（故意不在第一页）。

组件文档：**[web/src/components/ElSelectLoadmore.md](web/src/components/ElSelectLoadmore.md)**
