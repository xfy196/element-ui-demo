<template>
  <div id="app">
    <div class="nav">
      <el-radio-group v-model="tab" size="small">
        <el-radio-button label="address">省市区 Cascader</el-radio-button>
        <el-radio-button label="multi">多选分页 Select</el-radio-button>
      </el-radio-group>
    </div>
    <AddressForm v-if="tab === 'address'" />
    <MultiSelectForm v-else />
  </div>
</template>

<script>
import AddressForm from './views/AddressForm.vue'
import MultiSelectForm from './views/MultiSelectForm.vue'

export default {
  name: 'App',
  components: { AddressForm, MultiSelectForm },
  data() {
    return {
      tab: 'multi'
    }
  }
}
</script>

<style>
html,
body,
#app {
  margin: 0;
  min-height: 100%;
  background: #f5f7fa;
  font-family: 'Helvetica Neue', Helvetica, 'PingFang SC', 'Microsoft YaHei', Arial, sans-serif;
}
.nav {
  max-width: 900px;
  margin: 16px auto 0;
  padding: 0 16px;
}
</style>
