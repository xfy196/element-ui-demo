<template>
  <div class="page">
    <el-card shadow="never">
      <div slot="header" class="card-header">
        <span>省市区详情地址（懒加载 + 回显）</span>
        <div>
          <el-button size="small" @click="loadEdit(1)">加载示例 id=1</el-button>
          <el-button size="small" type="primary" plain @click="resetCreate">新建</el-button>
        </div>
      </div>

      <el-alert
        type="info"
        :closable="false"
        show-icon
        title="行政区划走 GET /api/basic/administrative-divisions；回显由前端按 codes 逐层请求拼 options，再赋值。"
        style="margin-bottom: 16px"
      />

      <el-form ref="form" :model="form" :rules="rules" label-width="100px" style="max-width: 640px">
        <el-form-item label="省市区" prop="regionCodes">
          <el-cascader
            :key="cascaderKey"
            v-model="form.regionCodes"
            :options="regionOptions"
            :props="cascaderProps"
            clearable
            filterable
            placeholder="请选择省 / 市 / 区"
            style="width: 100%"
          />
        </el-form-item>

        <el-form-item label="详情地址" prop="address">
          <el-input
            v-model="form.address"
            type="textarea"
            :rows="3"
            placeholder="街道、门牌号等"
          />
        </el-form-item>

        <el-form-item>
          <el-button type="primary" :loading="saving" @click="onSubmit">保存</el-button>
          <el-button @click="onReset">重置</el-button>
        </el-form-item>
      </el-form>

      <el-divider content-position="left">已保存记录</el-divider>
      <el-table :data="list" size="small" border>
        <el-table-column prop="id" label="ID" width="70" />
        <el-table-column label="省市区" min-width="220">
          <template slot-scope="{ row }">
            {{ (row.regionLabels || []).join(' / ') || (row.regionCodes || []).join(' / ') }}
          </template>
        </el-table-column>
        <el-table-column prop="address" label="详情地址" min-width="160" />
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
import {
  fetchRegionChildrenByCascaderLevel,
  buildRegionPathOptions,
  getAddress,
  saveAddress,
  listAddresses
} from '@/api/region'

export default {
  name: 'AddressForm',
  data() {
    return {
      form: {
        id: null,
        regionCodes: [],
        address: ''
      },
      regionOptions: [],
      cascaderKey: 0,
      saving: false,
      list: [],
      rules: {
        regionCodes: [
          { type: 'array', required: true, min: 3, message: '请选择完整省市区', trigger: 'change' }
        ],
        address: [{ required: true, message: '请输入详情地址', trigger: 'blur' }]
      },
      cascaderProps: {
        value: 'value',
        label: 'label',
        children: 'children',
        lazy: true,
        lazyLoad: this.lazyLoadRegions
      }
    }
  },
  created() {
    this.refreshList()
    this.loadEdit(1)
  },
  methods: {
    lazyLoadRegions(node, resolve) {
      const { level, value } = node
      // cascader level 0→PROVINCE, 1→CITY, 2→DISTRICT, 3→TOWNSHIP
      const parentCode = level === 0 ? undefined : value
      fetchRegionChildrenByCascaderLevel(level, parentCode)
        .then((items) => {
          const mapped = (items || []).map((item) => ({
            value: item.code,
            label: item.name,
            leaf: !item.hasChildren
          }))
          resolve(mapped)
        })
        .catch(() => resolve([]))
    },

    async loadEdit(id) {
      try {
        const record = await getAddress(id)
        await this.applyEcho(record)
        this.$message.success(`已回显地址 #${id}`)
      } catch (e) {
        this.$message.error('加载失败，请确认后端已启动且存在该记录')
      }
    },

    /**
     * 回显：无 path 接口，前端逐层拉 PROVINCE→CITY→DISTRICT 拼 options，再赋 value
     */
    async applyEcho(record) {
      const codes = record.regionCodes || []
      this.form = {
        id: record.id,
        regionCodes: [],
        address: record.address || ''
      }

      if (codes.length) {
        const pathData = await buildRegionPathOptions(codes)
        this.regionOptions = pathData.options || []
        this.cascaderKey += 1
        await this.$nextTick()
        this.form.regionCodes = codes.slice()
      } else {
        this.regionOptions = []
        this.cascaderKey += 1
      }
    },

    resetCreate() {
      this.form = { id: null, regionCodes: [], address: '' }
      this.regionOptions = []
      this.cascaderKey += 1
      this.$nextTick(() => this.$refs.form && this.$refs.form.clearValidate())
    },

    onReset() {
      if (this.form.id) {
        this.loadEdit(this.form.id)
      } else {
        this.resetCreate()
      }
    },

    onSubmit() {
      this.$refs.form.validate(async (valid) => {
        if (!valid) return
        this.saving = true
        try {
          const saved = await saveAddress({
            id: this.form.id || undefined,
            regionCodes: this.form.regionCodes,
            address: this.form.address
          })
          this.form.id = saved.id
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
        this.list = await listAddresses()
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
