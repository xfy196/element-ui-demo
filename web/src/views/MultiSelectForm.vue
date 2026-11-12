<template>
  <div class="page">
    <el-card shadow="never">
      <div slot="header" class="card-header">
        <span>多选下拉（ElSelectLoadmore 触底加载 + 批量 ID 回显）</span>
        <div>
          <el-button size="small" @click="loadEdit(1)">加载示例 id=1</el-button>
          <el-button size="small" type="primary" plain @click="resetCreate">新建</el-button>
        </div>
      </div>

      <el-alert
        type="info"
        :closable="false"
        show-icon
        style="margin-bottom: 16px"
        title="组件只负责触底/搜索回调；page、pageSize、请求与 options 合并均在页面侧完成。"
      />

      <el-form ref="form" :model="form" :rules="rules" label-width="100px" style="max-width: 640px">
        <el-form-item label="选项" prop="optionIds">
          <el-select-loadmore
            v-model="form.optionIds"
            :options="options"
            :loading="loading"
            :load-more-loading="loadMoreLoading"
            :has-more="hasMore"
            :load-more-offset="40"
            label-key="label"
            value-key="id"
            multiple
            clearable
            reserve-keyword
            placeholder="输入关键字搜索，或下拉滚动加载更多"
            style="width: 100%"
            @remote-search="onRemoteSearch"
            @load-more="onLoadMore"
            @visible-change="onVisibleChange"
          >
            <template slot-scope="{ options: dropdownOptions }">
              <el-option
                v-for="item in dropdownOptions"
                :key="item.id"
                :label="item.label"
                :value="item.id"
              >
                <span>{{ item.label }}</span>
                <span class="option-code">{{ item.code }}</span>
              </el-option>
            </template>
          </el-select-loadmore>
        </el-form-item>

        <el-form-item label="备注" prop="remark">
          <el-input v-model="form.remark" placeholder="可选" />
        </el-form-item>

        <el-form-item>
          <el-button type="primary" :loading="saving" @click="onSubmit">保存</el-button>
          <el-button @click="onReset">重置</el-button>
        </el-form-item>
      </el-form>

      <el-divider content-position="left">已保存记录</el-divider>
      <el-table :data="list" size="small" border>
        <el-table-column prop="id" label="ID" width="70" />
        <el-table-column label="已选" min-width="280">
          <template slot-scope="{ row }">
            {{ formatSelectedCell(row) }}
          </template>
        </el-table-column>
        <el-table-column prop="remark" label="备注" min-width="160" />
        <el-table-column label="操作" width="100">
          <template slot-scope="{ row }">
            <el-button type="text" @click="loadEdit(row.id)">编辑回显</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>
  </div>
</template>

<script>
import ElSelectLoadmore from '@/components/ElSelectLoadmore.vue'
import {
  fetchOptions,
  fetchOptionsByIds,
  mergeOptions,
  getSelection,
  saveSelection,
  listSelections
} from '@/api/options'

const PAGE_SIZE = 20

/** 空白表单，避免各处手写字段漏改 */
function createEmptyForm() {
  return {
    id: null,
    optionIds: [],
    remark: ''
  }
}

export default {
  name: 'MultiSelectForm',
  components: { ElSelectLoadmore },

  data() {
    return {
      form: createEmptyForm(),

      // pinned：已选/回显项，重置列表时始终保留在 options 前部，保证 label 能显示
      pinnedOptions: [],
      // 下拉当前展示列表（pinned + 当前页搜索结果）
      options: [],

      keyword: '',
      page: 1,
      hasMore: true,
      loading: false,
      loadMoreLoading: false,
      // 首次展开下拉时才拉第一页
      listInited: false,

      saving: false,
      list: [],
      rules: {
        optionIds: [
          { type: 'array', required: true, min: 1, message: '请至少选择一项', trigger: 'change' }
        ]
      }
    }
  },

  created() {
    this.refreshList()
    this.loadEdit(1)
  },

  methods: {
    // —— 下拉：展开 / 搜索 / 触底 ——

    onVisibleChange(visible) {
      if (visible && !this.listInited) {
        this.fetchList({ reset: true })
      }
    },

    onRemoteSearch(keyword) {
      this.keyword = keyword || ''
      this.fetchList({ reset: true })
    },

    onLoadMore() {
      if (!this.hasMore || this.loading || this.loadMoreLoading) return
      this.page += 1
      this.fetchList({ reset: false })
    },

    /**
     * reset=true：从第 1 页重查，用 pinned 合并结果
     * reset=false：追加下一页到现有 options
     */
    async fetchList({ reset } = {}) {
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
        const pageList = data.list || []
        this.hasMore = !!data.hasMore

        if (reset) {
          this.options = mergeOptions(this.pinnedOptions, pageList)
          this.listInited = true
        } else {
          this.options = mergeOptions(this.options, pageList)
        }
      } catch (e) {
        if (!reset) this.page = Math.max(1, this.page - 1)
        this.$message.error('加载选项失败')
      } finally {
        this.loading = false
        this.loadMoreLoading = false
      }
    },

    formatSelectedCell(row) {
      const labels = (row.optionLabels || []).join('、')
      const ids = (row.optionIds || []).join(',')
      return ids ? `${labels} (${ids})` : labels
    },

    // —— 回显 / 新建 / 重置 ——

    async loadEdit(id) {
      try {
        const record = await getSelection(id)
        await this.applyEcho(record)
        this.$message.success(`已回显选择 #${id}`)
      } catch (e) {
        this.$message.error('加载失败')
      }
    },

    /**
     * 回显：batch 已选项 → 写入 pinned → 拉第一页 merge → 再赋 v-model
     */
    async applyEcho(record) {
      const ids = (record.optionIds || []).map(Number)

      this.form = {
        id: record.id,
        optionIds: [],
        remark: record.remark || ''
      }
      this.keyword = ''
      this.listInited = false

      const pinned = ids.length ? await this.loadPinnedByIds(ids) : []
      this.pinnedOptions = pinned
      this.options = pinned.slice()

      await this.fetchList({ reset: true })
      await this.$nextTick()
      this.form.optionIds = ids.slice()
    },

    async loadPinnedByIds(ids) {
      const batch = await fetchOptionsByIds(ids)
      return batch.list || []
    },

    resetCreate() {
      this.form = createEmptyForm()
      this.pinnedOptions = []
      this.options = []
      this.keyword = ''
      this.page = 1
      this.hasMore = true
      this.listInited = false

      this.$nextTick(() => {
        if (this.$refs.form) this.$refs.form.clearValidate()
        this.fetchList({ reset: true })
      })
    },

    onReset() {
      if (this.form.id) {
        this.loadEdit(this.form.id)
      } else {
        this.resetCreate()
      }
    },

    // —— 保存 / 列表 ——

    onSubmit() {
      this.$refs.form.validate(async (valid) => {
        if (!valid) return

        this.saving = true
        try {
          const saved = await saveSelection({
            id: this.form.id || undefined,
            optionIds: this.form.optionIds,
            remark: this.form.remark
          })

          this.form.id = saved.id
          // 保存后同步 pinned，保证再次搜索时已选 label 不丢
          this.pinnedOptions = await this.loadPinnedByIds(saved.optionIds)
          this.options = mergeOptions(this.pinnedOptions, this.options)

          this.$message.success(`保存成功，id=${saved.id}`)
          await this.refreshList()
        } catch (e) {
          this.$message.error('保存失败')
        } finally {
          this.saving = false
        }
      })
    },

    async refreshList() {
      try {
        this.list = await listSelections()
      } catch (e) {
        this.list = []
      }
    }
  }
}
</script>

<style scoped>
.page {
  max-width: 900px;
  margin: 24px auto;
  padding: 0 16px;
}
.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.option-code {
  float: right;
  color: #8492a6;
  font-size: 12px;
}
</style>
