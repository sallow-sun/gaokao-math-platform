import { METHOD_PROFILES } from './demoCorpus.js'

const TAXONOMY = {
  knowledge: [
    { label: '导数', aliases: /导数|求导|微分|导函数|单调性|极值|切线/ },
    { label: '函数零点', aliases: /函数零点|零点|实根|方程.{0,4}根/ },
    { label: '单调性', aliases: /单调|增区间|减区间/ },
    { label: '极值', aliases: /极值|极值点/ },
    { label: '解析几何', aliases: /解析几何|椭圆|抛物线|双曲线|圆锥曲线|坐标法/ },
    { label: '椭圆', aliases: /椭圆/ },
    { label: '抛物线', aliases: /抛物线/ },
    { label: '双曲线', aliases: /双曲线/ },
    { label: '概率统计', aliases: /概率统计|概率|随机抽取|抽样/ },
    { label: '条件概率', aliases: /条件概率|已知.{0,8}概率|后验概率/ },
    { label: '随机变量', aliases: /随机变量|期望|方差|分布列|答对人数/ },
    { label: '数列', aliases: /数列|等差|等比|前\s*n\s*项和/i },
    { label: '不等式', aliases: /不等式|证明.{0,16}[<>≤≥]/ },
  ],
  methods: [
    { label: '隐零点', aliases: /隐零点|零点方程|零点关系|根间关系|两个零点|x[₁1].{0,12}x[₂2]|代入.{0,8}消参|用.{0,8}零点.{0,8}参数/i },
    { label: '分类讨论', aliases: /分类讨论|分类分析|分情况|临界值|参数.{0,8}讨论|讨论.{0,8}参数/ },
    { label: '构造函数', aliases: /构造.{0,6}函数|辅助函数/ },
    { label: '分离参数', aliases: /分离参数|参数分离|移项.{0,6}参数|转化.{0,6}值域/ },
    { label: '同构变形', aliases: /同构|统一.{0,8}函数模型/ },
    { label: '切线放缩', aliases: /切线放缩|切线.{0,8}(界|估计)|线性界/ },
    { label: '设而不求', aliases: /设而不求|不求.{0,6}交点|保留.{0,8}根.{0,4}(和|积)/ },
    { label: '韦达定理', aliases: /韦达|根与系数|根的和.{0,5}根的积/ },
    { label: '定点定值', aliases: /定点定值|定点|定值|不变量/ },
    { label: '弦长公式', aliases: /弦长公式|弦长/ },
    { label: '全概率公式', aliases: /全概率|按来源.{0,8}(划分|加权)/ },
    { label: '贝叶斯公式', aliases: /贝叶斯|后验概率|反推.{0,8}来源/ },
    { label: '期望计算', aliases: /期望计算|数学期望|计算.{0,6}期望/ },
  ],
  structure: [
    { label: '含参函数', aliases: /含参函数|含参数.{0,6}函数|参数.{0,8}函数|函数.{0,8}参数/ },
    { label: '双零点', aliases: /双零点|两个零点|两.{0,4}零点|x[₁1].{0,12}x[₂2]/i },
    { label: '不等式证明', aliases: /不等式证明|证明.{0,30}[<>≤≥]|证明.{0,8}不等式/ },
    { label: '参数范围', aliases: /参数范围|参数.{0,8}取值|讨论.{0,8}参数/ },
    { label: '直线交曲线', aliases: /直线.{0,10}(交|与).{0,10}(椭圆|抛物线|双曲线|曲线)/ },
    { label: '双交点', aliases: /交.{0,8}[Aa].{0,3}[Bb].{0,4}两点|两个交点|双交点/i },
    { label: '定值与范围', aliases: /定值.{0,15}范围|范围.{0,15}定值/ },
    { label: '分类抽样', aliases: /分类抽样|甲.{0,5}乙.{0,12}(抽取|样本)/ },
    { label: '逆向条件概率', aliases: /逆向条件概率|已知结果.{0,10}(来源|来自)|答对时.{0,8}来自/ },
    { label: '重复试验', aliases: /重复试验|重复抽样|独立重复/ },
    { label: '轨迹', aliases: /轨迹/ },
    { label: '最值', aliases: /最值|最大值|最小值/ },
    { label: '分布列', aliases: /分布列|概率分布/ },
  ],
}

export const CANONICAL_FEATURE_LABELS = Object.fromEntries(
  Object.entries(TAXONOMY).map(([field, rules]) => [field, rules.map((rule) => rule.label)]),
)

function unique(values) {
  return [...new Set(values.map((value) => String(value).trim()).filter(Boolean))]
}

function canonicalize(field, values = [], sourceText = '') {
  const rules = TAXONOMY[field]
  const canonical = []
  const unmatched = []

  unique(values).forEach((value) => {
    const matches = rules.filter((rule) => rule.aliases.test(value))
    if (matches.length) canonical.push(...matches.map((rule) => rule.label))
    else unmatched.push(value)
  })
  rules.forEach((rule) => {
    if (rule.aliases.test(sourceText)) canonical.push(rule.label)
  })
  return unique([...canonical, ...unmatched]).slice(0, 10)
}

function canonicalStrategy(methods, structure) {
  const profiles = methods.map((method) => METHOD_PROFILES[method]).filter(Boolean)
  const goals = structure.filter((term) => /(证明|范围|定值|最值|零点|轨迹|期望|方差|分布|关系)/.test(term))
  return {
    trigger_conditions: unique([...profiles.flatMap((profile) => profile.triggers), ...structure.slice(0, 2)]),
    goals: unique(goals.length ? goals : structure.slice(-1)),
    operations: unique(profiles.flatMap((profile) => profile.operations)),
    key_transformations: unique(profiles.flatMap((profile) => profile.transforms)),
    constraints: unique(structure.filter((term) => /(含参|双|范围|重复|分类)/.test(term))),
    branch_points: methods.includes('分类讨论') ? ['参数临界值', '符号变化'] : [],
  }
}

function mergeStrategy(original = {}, canonical) {
  return Object.fromEntries(
    Object.keys(canonical).map((field) => [field, unique([...(canonical[field] || []), ...(original[field] || [])]).slice(0, 16)]),
  )
}

export function normalizeFeatures(raw = {}, sourceText = '') {
  const text = String(sourceText || raw.text || '').trim()
  const knowledge = canonicalize('knowledge', raw.knowledge, text)
  const methods = canonicalize('methods', raw.methods, text)
  const structure = canonicalize('structure', raw.structure, text)
  const strategy = mergeStrategy(raw.strategy, canonicalStrategy(methods, structure))
  return { ...raw, text, knowledge, methods, structure, strategy }
}
