# ElSelectLoadmore

基于 Element UI `el-select` 的二次封装：**只负责 UI 与触发回调**，不内置分页参数、不耦合接口。

- 远程搜索 → `$emit('remote-search', keyword)`
- 触底加载 → `$emit('load-more')`
- `page` / `pageSize` / 请求 / `options` 合并 → **全部由外部完成**

路径：[`ElSelectLoadmore.vue`](./ElSelectLoadmore.vue)  
演示：[`../views/MultiSelectForm.vue`](../views/MultiSelectForm.vue)

---

## 职责边界

| 组件内 | 组件外（业务页） |
| --- | --- |
| 透传 `el-select` 属性/事件/插槽 | 维护 `options` |
| 自定义指令监听触底 | 维护 `page` / `pageSize` / `keyword` / `hasMore` |
| 抛出 `remote-search` / `load-more` | 调用接口、追加/重置列表 |
| 展示 `loading` / `loadMoreLoading` 状态 | 控制这两个 loading 布尔值 |
| `loadMoreOffset` 触底距离 | 回显 batch + merge |

---

## 快速开始

```vue
<template>
  <el-select-loadmore
    v-model="form.ids"
    :options="options"
    :loading="loading"
    :load-more-loading="loadMoreLoading"
    :has-more="hasMore"
    :load-more-offset="40"
    multiple
    clearable
    @remote-search="onRemoteSearch"
    @load-more="onLoadMore"
    @visible-change="onVisibleChange"
  />
</template>

<script>
import ElSelectLoadmore from '@/components/ElSelectLoadmore.vue'
import { fetchOptions, mergeOptions } from '@/api/options'

const PAGE_SIZE = 20

export default {
  components: { ElSelectLoadmore },
  data() {
    return {
      form: { ids: [] },
      options: [],
      selectedOptions: [],
      keyword: '',
      page: 1,
      hasMore: true,
      loading: false,
      loadMoreLoading: false,
      inited: false
    }
  },
  methods: {
    onVisibleChange(visible) {
      if (visible && !this.inited) this.fetchList({ reset: true })
    },
    onRemoteSearch(keyword) {
      this.keyword = keyword
      this.fetchList({ reset: true })
    },
    onLoadMore() {
      if (!this.hasMore || this.loading || this.loadMoreLoading) return
      this.page += 1
      this.fetchList({ reset: false })
    },
    async fetchList({ reset }) {
      if (reset) {
        this.page = 1
        this.hasMore = true
        this.loading = true
      } else {
        this.loadMoreLoading = true
      }
      try {
        const data = await fetchOptions({
          keyword: this.keyword,
          page: this.page,
          pageSize: PAGE_SIZE
        })
        this.hasMore = !!data.hasMore
        this.options = reset
          ? mergeOptions(this.selectedOptions, data.list)
          : mergeOptions(this.options, data.list)
        this.inited = true
      } finally {
        this.loading = false
        this.loadMoreLoading = false
      }
    }
  }
}
</script>
```

自定义 option：

```vue
<el-select-loadmore
  v-model="ids"
  :options="options"
  @remote-search="onRemoteSearch"
  @load-more="onLoadMore"
>
  <template slot-scope="{ options: opts }">
    <el-option
      v-for="item in opts"
      :key="item.id"
      :label="item.label"
      :value="item.id"
    />
  </template>
</el-select-loadmore>
```

---

## Props

| 属性 | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `value` / `v-model` | `String / Number / Array / ...` | — | 选中值 |
| `options` | `Array` | `[]` | 选项列表（外部维护） |
| `loading` | `Boolean` | `false` | 首屏/搜索 loading → `el-select` 的 `:loading` |
| `loadMoreLoading` | `Boolean` | `false` | 触底追加 loading → 底部禁用 option「加载中...」 |
| `hasMore` | `Boolean` | `true` | 为 `false` 时不再触发 `load-more`，并显示「没有更多了」 |
| `labelKey` | `String` | `'label'` | 默认 option 展示字段 |
| `valueKey` | `String` | `'id'` | 默认 option 值字段 |
| `loadMoreOffset` | `Number` | `5` | 距底部多少 **px** 内触发触底 |

### 透传属性

`inheritAttrs: false`，其余属性经 `v-bind="$attrs"` 传给内部 `el-select`（如 `multiple`、`clearable`、`placeholder`、`disabled` 等）。

组件内部固定：

- `filterable` / `remote` / `remote-method`（触发后只 `$emit('remote-search')`）
- `:loading` 使用 prop `loading`（外部传入）

---

## Events

| 事件名 | 参数 | 说明 |
| --- | --- | --- |
| `input` | `(value)` | `v-model` |
| `remote-search` | `(keyword: string)` | 远程搜索；`keyword` 已 `trim` |
| `load-more` | — | 触底触发；组件内会用 `hasMore` / `loading` / `loadMoreLoading` 做防抖守卫 |
| `visible-change` | `(visible: boolean)` | 下拉显隐；首次打开可在此拉第一页 |

其它 `el-select` 事件（`change`、`clear`、`blur`、`focus` 等）经 `$listeners` 转发。

---

## Slots

| 插槽 | 作用域 | 说明 |
| --- | --- | --- |
| 默认 | `{ options }` | 自定义 `el-option`；默认按 `labelKey` / `valueKey` 渲染 |

底部自动追加禁用状态 option：`加载中...` / `没有更多了`。

---

## 触底原理

下拉打开后，指令绑定内部滚动容器：

`select.$refs.scrollbar.$refs.wrap`（兼容 `append-to-body`）

```text
scrollTop + clientHeight >= scrollHeight - loadMoreOffset  →  $emit('load-more')
```

```vue
<el-select-loadmore :load-more-offset="40" @load-more="onLoadMore" />
```

---

## 回显（业务侧）

组件不负责 batch / merge。推荐流程：

1. `POST /options/batch` 查出已选对象 → `selectedOptions`
2. 拉第一页 → `options = mergeOptions(selectedOptions, pageList)`
3. `$nextTick` 后再赋 `v-model`

见演示页 [`MultiSelectForm.vue`](../views/MultiSelectForm.vue) 的 `applyEcho`。

---

## 注意事项

1. **不要把 page / pageSize 写进本组件**；分页状态放在使用方。
2. 首次数据：监听 `@visible-change` 自行 `fetch`，或进入页时预加载。
3. `load-more` 触发后由外部 `page++` 再请求；失败时外部自行回退页码。
4. 单页高度不足以滚动时无法触底，需调大 `pageSize` 或接口策略。
