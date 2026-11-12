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
            <template slot-scope="{ options: opts }">
              <el-option
                v-for="item in opts"
                :key="item.id"
                :label="item.label"
                :value="item.id"
              >
                <span>{{ item.label }}</span>
                <span style="float: right; color: #8492a6; font-size: 12px">{{ item.code }}</span>
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
            {{ (row.optionLabels || []).join('、') }}
            <span style="color: #909399"> ({{ (row.optionIds || []).join(',') }})</span>
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

export default {
  name: 'MultiSelectForm',
  components: { ElSelectLoadmore },
  data() {
    return {
      form: {
        id: null,
        optionIds: [],
        remark: ''
      },
      selectedOptions: [],
      options: [],
      keyword: '',
      page: 1,
      hasMore: true,
      loading: false,
      loadMoreLoading: false,
      inited: false,
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
    onVisibleChange(visible) {
      if (visible && !this.inited) {
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
          this.options = mergeOptions(this.selectedOptions, pageList)
          this.inited = true
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
     * 回显：batch 已选项 → 与第一页 merge → 再赋 v-model
     */
    async applyEcho(record) {
      const ids = (record.optionIds || []).map(Number)
      this.form = {
        id: record.id,
        optionIds: [],
        remark: record.remark || ''
      }
      this.keyword = ''
      this.inited = false

      let preset = []
      if (ids.length) {
        const batch = await fetchOptionsByIds(ids)
        preset = batch.list || []
      }
      this.selectedOptions = preset
      this.options = preset.slice()

      await this.fetchList({ reset: true })
      await this.$nextTick()
      this.form.optionIds = ids.slice()
    },

    resetCreate() {
      this.form = { id: null, optionIds: [], remark: '' }
      this.selectedOptions = []
      this.options = []
      this.keyword = ''
      this.page = 1
      this.hasMore = true
      this.inited = false
      this.$nextTick(() => {
        this.$refs.form && this.$refs.form.clearValidate()
        this.fetchList({ reset: true })
      })
    },

    onReset() {
      if (this.form.id) this.loadEdit(this.form.id)
      else this.resetCreate()
    },

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
          const batch = await fetchOptionsByIds(saved.optionIds)
          this.selectedOptions = batch.list || []
          this.options = mergeOptions(this.selectedOptions, this.options)
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
</style>
