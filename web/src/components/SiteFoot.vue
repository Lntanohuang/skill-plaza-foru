<script setup lang="ts">
import { CHECKED_ON, SKILLS } from '../data/skills'
</script>

<template>
  <footer class="site-foot">
    <div class="wrap foot-inner">
      <p class="foot-note">
        {{ SKILLS.length }} 个条目都指向公开 GitHub 仓库，仓库可匿名读取。页面不执行 SKILL，也不生成推测的日期、版本、评分或下载量；依赖、费用与许可以各 SKILL 的发布资料为准。清单最后核对 {{ CHECKED_ON }}。
      </p>
      <nav class="foot-links" aria-label="页脚导航">
        <RouterLink to="/skills">SKILL 列表</RouterLink>
        <RouterLink to="/guide">使用指南</RouterLink>
        <RouterLink to="/guide">怎么用？</RouterLink>
      </nav>
    </div>
  </footer>
</template>
