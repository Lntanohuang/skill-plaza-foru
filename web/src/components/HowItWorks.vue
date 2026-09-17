<script setup lang="ts">
const steps = [
  {
    no: '1',
    title: '挑一个 SKILL',
    desc: '按角色或分类浏览，进详情看产物、条件和边界，确认是不是你需要的。',
  },
  {
    no: '2',
    title: '复制提示词，发给你的 AI',
    desc: '详情页的安装提示词一键复制，发给 AI 工具就会把完整目录装好。',
  },
  {
    no: '3',
    title: '跑一次最小任务',
    desc: '用详情页的最小输入示例开始，把示例里的内容换成你自己的即可。',
  },
]
</script>

<template>
  <section class="how-sec">
    <div class="wrap">
      <div class="section-head" v-reveal>
        <h2>三步开始使用</h2>
        <p>不用注册、不用联网执行，复制提示词在你的 AI 工具里完成。</p>
      </div>

      <div class="how-grid">
        <div v-for="(step, i) in steps" :key="step.no" class="how-card" v-reveal="i * 90">
          <span class="how-no">{{ step.no }}</span>
          <h3 class="how-title">{{ step.title }}</h3>
          <p class="how-desc">{{ step.desc }}</p>
        </div>
      </div>

      <p class="how-more" v-reveal="300">
        <RouterLink class="text-btn" to="/guide">还有疑问？查看完整使用指南 →</RouterLink>
      </p>
    </div>
  </section>
</template>
