<script setup lang="ts">
import { type Feature } from '../data/skills'
import Icon from './Icon.vue'

withDefaults(defineProps<{ feature: Feature; detail?: boolean }>(), { detail: false })
</script>

<template>
  <div class="foru-window">
    <span class="fw-dots" aria-hidden="true"><i></i><i></i><i></i></span>
    <span>产物示意 · 非真实运行结果</span>
  </div>
  <div class="preview-frame">
    <div class="preview-topline"><strong>{{ feature.title }}</strong><span>SKILL</span></div>
    <div class="preview-inner">
      <!-- 产业决策报告 -->
      <div v-if="feature.id === 'industry'" class="report-preview">
        <aside class="report-sidebar"><span>产业链</span><span>岗位人才</span><span>专业课程</span><span>就业反馈</span></aside>
        <div class="report-page">
          <h3>新能源汽车专业建设报告</h3>
          <p>分别标注事实、推断、建议和缺数，让每项关键结论都能回到来源。</p>
          <table class="report-table">
            <thead><tr><th>决策主题</th><th>证据状态</th></tr></thead>
            <tbody>
              <tr><td>产业与岗位</td><td>来源与口径已登记</td></tr>
              <tr><td>专业与课程</td><td>待补院校微观数据</td></tr>
              <tr><td>建设建议</td><td>关联证据与限制</td></tr>
            </tbody>
          </table>
          <span class="citation-chip">结构校验 + 语义审核</span>
        </div>
      </div>

      <!-- 课堂助教 -->
      <template v-else-if="feature.id === 'teaching'">
        <div class="mini-website">
          <div>
            <h3>课程资料<br>变成可学内容</h3>
            <p>答疑 · 要点 · 练习</p>
            <span class="mini-pill">每条结论附定位引用</span>
          </div>
          <svg viewBox="0 0 360 310" aria-hidden="true"><use href="#foru-scene-ai" /></svg>
        </div>
        <div class="mini-entry-row"><span>授权资料</span><span>课堂练习</span><span>待教师清单</span></div>
      </template>

      <!-- AI 面试练习 -->
      <template v-else-if="feature.id === 'interview'">
        <div class="video-stage">
          <div>
            <span>岗位与简历分析</span><br>
            <strong>一次一题<br>根据回答追问</strong>
          </div>
          <svg viewBox="0 0 100 95" aria-hidden="true">
            <g fill="#76C6FF">
              <rect x="8" y="50" width="8" height="12" rx="4" /><rect x="23" y="38" width="8" height="24" rx="4" />
              <rect x="38" y="20" width="8" height="42" rx="4" /><rect x="53" y="30" width="8" height="32" rx="4" />
              <rect x="68" y="12" width="8" height="50" rx="4" /><rect x="83" y="25" width="8" height="37" rx="4" />
            </g>
          </svg>
        </div>
        <div class="timeline">
          <div class="time-ruler"><span>开始练习</span><span>形成报告</span></div>
          <div class="time-track"><span>能力地图</span><span>逐题问答</span><span>重答</span></div>
          <div class="time-track audio"><span>Q1 → A1 → Q1-F1 → A1-F1</span></div>
          <div class="time-track"><span>原话引用</span><span>待验证项</span><span>改进建议</span></div>
        </div>
      </template>

      <!-- 训练数据治理流程图 -->
      <svg
        v-else
        class="diagram-preview"
        role="img"
        aria-label="训练数据治理流程示例：治理数据依次经过样本构造、机器质检和专家抽检，再形成可追溯版本"
        viewBox="0 0 500 245"
      >
        <rect x="12" y="28" width="476" height="188" rx="12" fill="#162544" stroke="#5F9EFF" stroke-dasharray="5 5" />
        <g fill="#CDE1FF" font-family="sans-serif" font-size="13"><text x="29" y="52">数据治理与验收边界</text></g>
        <g fill="none" stroke="#69AFFF" stroke-width="2"><path d="M122 124h30m102 0h30m102 0h22" /></g>
        <g fill="#223B66" stroke="#628FCC">
          <rect x="28" y="92" width="94" height="64" rx="8" /><rect x="152" y="92" width="102" height="64" rx="8" />
          <rect x="284" y="92" width="102" height="64" rx="8" /><rect x="408" y="92" width="64" height="64" rx="8" />
        </g>
        <g fill="#FFF" text-anchor="middle" font-size="13" font-family="sans-serif">
          <text x="75" y="120">治理数据</text><text x="75" y="139">与规则</text>
          <text x="203" y="120">样本构造</text><text x="203" y="139">四类划分</text>
          <text x="335" y="120">机器质检</text><text x="335" y="139">专家抽检</text>
          <text x="440" y="120">封存</text><text x="440" y="139">版本</text>
        </g>
        <g fill="#A8C3E8" font-size="12" font-family="sans-serif">
          <text x="29" y="188">候选结果 ≠ 专家确认 · 全程保留来源与谱系</text>
        </g>
      </svg>
    </div>
  </div>
  <div class="preview-footer">
    <div class="foru-tags">
      <span v-for="tag in feature.tags.slice(0, 2)" :key="tag">{{ tag }}</span>
    </div>
    <span v-if="detail">示意预览</span>
    <RouterLink v-else :to="`/skill/${feature.slug}`">查看详情<Icon name="chev" :size="14" /></RouterLink>
  </div>
</template>
