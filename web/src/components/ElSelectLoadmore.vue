<template>
  <el-select
    ref="select"
    :value="value"
    v-bind="$attrs"
    v-on="forwardListeners"
    :loading="loading"
    :filterable="true"
    :remote="true"
    :remote-method="onRemoteSearch"
    v-el-select-loadmore="onLoadMore"
    @input="onInput"
    @visible-change="onVisibleChange"
  >
    <slot :options="options">
      <el-option
        v-for="item in options"
        :key="item[valueKey]"
        :label="item[labelKey]"
        :value="item[valueKey]"
      />
    </slot>
    <el-option
      v-if="showStatusOption"
      disabled
      :value="STATUS_VALUE"
      :label="statusLabel"
    />
  </el-select>
</template>

<script>
const STATUS_VALUE = '__el_select_loadmore_status__'

/**
 * 触底加载指令：通过 el-select 实例取 scrollbar wrap（兼容 append-to-body）
 */
const elSelectLoadmore = {
  bind(el, binding, vnode) {
    const select = vnode.componentInstance
    if (!select) return

    const state = {
      wrap: null,
      onScroll: null
    }

    const getOffset = () => {
      const ctx = vnode.context
      const n = ctx && Number(ctx.loadMoreOffset)
      return Number.isFinite(n) && n >= 0 ? n : 5
    }

    const unbindScroll = () => {
      if (state.wrap && state.onScroll) {
        state.wrap.removeEventListener('scroll', state.onScroll)
      }
      state.wrap = null
      state.onScroll = null
    }

    const bindScroll = () => {
      unbindScroll()
      const wrap =
        select.$refs &&
        select.$refs.scrollbar &&
        select.$refs.scrollbar.$refs &&
        select.$refs.scrollbar.$refs.wrap
      if (!wrap) return
      state.wrap = wrap
      state.onScroll = function onScroll() {
        const offset = getOffset()
        if (this.scrollTop + this.clientHeight >= this.scrollHeight - offset) {
          typeof binding.value === 'function' && binding.value()
        }
      }
      wrap.addEventListener('scroll', state.onScroll)
    }

    const onVisibleChange = (visible) => {
      if (visible) {
        select.$nextTick(() => bindScroll())
      } else {
        unbindScroll()
      }
    }

    select.$on('visible-change', onVisibleChange)
    el.__elSelectLoadmore__ = { unbindScroll, onVisibleChange, select }
  },
  unbind(el) {
    const ctx = el.__elSelectLoadmore__
    if (!ctx) return
    ctx.unbindScroll()
    if (ctx.select && ctx.onVisibleChange) {
      ctx.select.$off('visible-change', ctx.onVisibleChange)
    }
    delete el.__elSelectLoadmore__
  }
}

export default {
  name: 'ElSelectLoadmore',
  inheritAttrs: false,
  directives: {
    'el-select-loadmore': elSelectLoadmore
  },
  props: {
    value: {
      type: [String, Number, Array, Boolean, Object],
      default: undefined
    },
    /** 选项列表由外部维护 */
    options: {
      type: Array,
      default() {
        return []
      }
    },
    /** 首屏 / 搜索 loading（绑定 el-select :loading） */
    loading: {
      type: Boolean,
      default: false
    },
    /** 触底追加 loading（底部状态条，不闪整个下拉） */
    loadMoreLoading: {
      type: Boolean,
      default: false
    },
    /** 是否还有更多；为 false 时不再触发 load-more */
    hasMore: {
      type: Boolean,
      default: true
    },
    labelKey: {
      type: String,
      default: 'label'
    },
    valueKey: {
      type: String,
      default: 'id'
    },
    /** 距底部多少 px 内触发触底加载 */
    loadMoreOffset: {
      type: Number,
      default: 5
    }
  },
  data() {
    return {
      STATUS_VALUE
    }
  },
  computed: {
    forwardListeners() {
      const listeners = { ...this.$listeners }
      delete listeners.input
      delete listeners['visible-change']
      delete listeners['remote-search']
      delete listeners['load-more']
      return listeners
    },
    showStatusOption() {
      return this.loadMoreLoading || (!this.hasMore && this.options.length > 0)
    },
    statusLabel() {
      if (this.loadMoreLoading) return '加载中...'
      return '没有更多了'
    }
  },
  methods: {
    onInput(val) {
      this.$emit('input', val)
    },

    onVisibleChange(visible) {
      this.$emit('visible-change', visible)
    },

    /** 远程搜索：只把关键字抛给外部 */
    onRemoteSearch(query) {
      this.$emit('remote-search', (query || '').trim())
    },

    /** 触底：只通知外部，分页参数由外部决定 */
    onLoadMore() {
      if (!this.hasMore || this.loading || this.loadMoreLoading) return
      this.$emit('load-more')
    }
  }
}
</script>
