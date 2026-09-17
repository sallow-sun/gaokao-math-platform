export const SIMILARITY_SAMPLES = {
  derivative: {
    label: '导数 · 隐零点与参数分类',
    text: '已知函数 f(x)=x-a ln x（a>0）。若函数存在两个零点 x₁、x₂，证明 x₁x₂<a²，并讨论参数 a 对函数单调性与零点个数的影响。',
    knowledge: ['导数', '函数零点', '单调性'],
    methods: ['隐零点', '分类讨论', '构造函数'],
    structure: ['含参函数', '双零点', '不等式证明'],
    difficulty: 0.72,
  },
  conic: {
    label: '圆锥曲线 · 弦长与定点',
    text: '已知椭圆 C:x²/a²+y²/b²=1，过定点 P 的直线交椭圆于 A、B 两点。证明直线 OA、OB 的斜率之和为定值，并求弦 AB 长度的取值范围。',
    knowledge: ['解析几何', '椭圆', '直线与圆锥曲线'],
    methods: ['设而不求', '韦达定理', '定点定值'],
    structure: ['直线交曲线', '双交点', '定值与范围'],
    difficulty: 0.68,
  },
  probability: {
    label: '概率统计 · 条件概率与期望',
    text: '某学校从甲、乙两类学生中随机抽取样本。已知抽到甲类的概率为 0.6，甲类中答对某题的概率为 0.8。求已知答对时来自甲类的概率，并计算重复抽样下答对人数的期望。',
    knowledge: ['概率统计', '条件概率', '随机变量'],
    methods: ['全概率公式', '贝叶斯公式', '期望计算'],
    structure: ['分类抽样', '逆向条件概率', '重复试验'],
    difficulty: 0.48,
  },
}

export const SIMILARITY_DEMO_CORPUS = [
  { id: 'DEMO-D01', title: '含参函数的隐零点与乘积估计', detail: '利用零点方程消去参数，再建立两个零点之间的不等式关系。', year: '2024', sourceLabel: '模拟精选', typeLabel: '解答题', level: 'purple', knowledge: ['导数', '函数零点', '单调性'], methods: ['隐零点', '构造函数', '换元'], structure: ['含参函数', '双零点', '不等式证明'], difficulty: 0.76, quality: 0.93 },
  { id: 'DEMO-D02', title: '函数零点个数与参数范围', detail: '根据参数临界值分类讨论函数单调性与零点数量。', year: '2023', sourceLabel: '全国卷改编', typeLabel: '解答题', level: 'blue', knowledge: ['导数', '函数零点', '单调性'], methods: ['分类讨论', '分离参数'], structure: ['含参函数', '零点个数', '参数范围'], difficulty: 0.66, quality: 0.97 },
  { id: 'DEMO-D03', title: '极值点偏移中的同构变形', detail: '把双变量比较统一到同一个函数模型中，再利用单调性判断。', year: '2025', sourceLabel: '联考', typeLabel: '解答题', level: 'black', knowledge: ['导数', '极值', '函数不等式'], methods: ['同构变形', '构造函数', '隐零点'], structure: ['双函数比较', '不等式证明', '极值点'], difficulty: 0.83, quality: 0.88 },
  { id: 'DEMO-D04', title: '双零点条件下的对称关系', detail: '保留零点方程，通过变量代换研究根之间的对称关系。', year: '2022', sourceLabel: '真题改编', typeLabel: '解答题', level: 'purple', knowledge: ['导数', '函数零点', '单调性'], methods: ['隐零点', '对称变换'], structure: ['双零点', '变量代换', '不等式证明'], difficulty: 0.71, quality: 0.91 },
  { id: 'DEMO-D05', title: '利用切线放缩证明函数不等式', detail: '选择合适切点建立线性界，再构造辅助函数完成证明。', year: '2021', sourceLabel: '高考真题', typeLabel: '解答题', level: 'blue', knowledge: ['导数', '函数不等式', '切线'], methods: ['切线放缩', '构造函数'], structure: ['不等式证明', '辅助函数', '最值'], difficulty: 0.69, quality: 0.99 },
  { id: 'DEMO-C01', title: '椭圆弦中斜率和为定值', detail: '联立直线与椭圆方程，用韦达定理消去交点坐标。', year: '2024', sourceLabel: '高考真题', typeLabel: '解答题', level: 'purple', knowledge: ['解析几何', '椭圆', '直线与圆锥曲线'], methods: ['设而不求', '韦达定理', '定点定值'], structure: ['直线交曲线', '双交点', '定值与范围'], difficulty: 0.7, quality: 0.99 },
  { id: 'DEMO-C02', title: '抛物线弦的中点轨迹问题', detail: '保留交点根的和与积，消去动直线参数得到轨迹。', year: '2023', sourceLabel: '模拟精选', typeLabel: '解答题', level: 'blue', knowledge: ['解析几何', '抛物线', '轨迹'], methods: ['设而不求', '韦达定理'], structure: ['直线交曲线', '双交点', '轨迹方程'], difficulty: 0.64, quality: 0.9 },
  { id: 'DEMO-C03', title: '双曲线中的定点与面积最值', detail: '分析动直线参数与面积表达式，寻找不变量并求最值。', year: '2025', sourceLabel: '联考', typeLabel: '解答题', level: 'purple', knowledge: ['解析几何', '双曲线', '直线与圆锥曲线'], methods: ['定点定值', '基本不等式'], structure: ['直线交曲线', '面积最值', '定点定值'], difficulty: 0.78, quality: 0.9 },
  { id: 'DEMO-C04', title: '椭圆焦点弦长的取值范围', detail: '由判别式确定参数范围，再用弦长公式求值域。', year: '2022', sourceLabel: '高考真题', typeLabel: '解答题', level: 'green', knowledge: ['解析几何', '椭圆', '弦长'], methods: ['弦长公式', '韦达定理'], structure: ['直线交曲线', '双交点', '范围求解'], difficulty: 0.61, quality: 0.98 },
  { id: 'DEMO-P01', title: '条件概率与全概率模型', detail: '先按来源划分样本空间，再由结果反推所属类别。', year: '2024', sourceLabel: '高考真题', typeLabel: '解答题', level: 'green', knowledge: ['概率统计', '条件概率', '随机变量'], methods: ['全概率公式', '贝叶斯公式'], structure: ['分类抽样', '逆向条件概率', '重复试验'], difficulty: 0.51, quality: 0.99 },
  { id: 'DEMO-P02', title: '二项分布中的期望与方差', detail: '识别重复独立试验，建立分布并计算数字特征。', year: '2023', sourceLabel: '全国卷', typeLabel: '解答题', level: 'cyan', knowledge: ['概率统计', '随机变量', '二项分布'], methods: ['期望计算', '方差计算'], structure: ['重复试验', '分布列', '数字特征'], difficulty: 0.46, quality: 0.98 },
  { id: 'DEMO-P03', title: '检测模型中的贝叶斯推断', detail: '综合灵敏度与先验概率，计算观察结果对应的后验概率。', year: '2025', sourceLabel: '情境创新', typeLabel: '解答题', level: 'green', knowledge: ['概率统计', '条件概率', '独立性'], methods: ['贝叶斯公式', '全概率公式'], structure: ['分类抽样', '逆向条件概率', '事件树'], difficulty: 0.6, quality: 0.87 },
]

export const METHOD_PROFILES = {
  隐零点: { triggers: ['零点无法显式求解', '存在性已知'], operations: ['设零点方程', '代回消参', '建立根间关系'], transforms: ['用零点方程替换参数'] },
  分类讨论: { triggers: ['含参数', '符号或位置不确定'], operations: ['确定临界值', '分区间讨论', '合并结论'], transforms: ['把参数空间划分为有限情形'] },
  构造函数: { triggers: ['比较式或不等式', '原式难直接判断'], operations: ['构造辅助函数', '求导判断单调性', '利用最值'], transforms: ['把目标差转化为函数符号'] },
  分离参数: { triggers: ['参数与变量可分离'], operations: ['移项分离参数', '研究值域', '反推参数范围'], transforms: ['把参数问题转化为函数值域'] },
  同构变形: { triggers: ['两侧含相似超越结构'], operations: ['识别同构表达式', '统一函数模型', '利用单调性比较'], transforms: ['把双变量比较转化为同一函数比较'] },
  切线放缩: { triggers: ['凸凹函数不等式'], operations: ['选择切点', '写出切线', '建立上下界'], transforms: ['把复杂函数替换为线性界'] },
  设而不求: { triggers: ['直线与曲线有两个交点'], operations: ['联立方程', '保留根的和积', '代入目标式'], transforms: ['把交点坐标转化为韦达量'] },
  韦达定理: { triggers: ['二次方程双根'], operations: ['取得根和根积', '对称式化简'], transforms: ['把坐标运算转化为系数运算'] },
  定点定值: { triggers: ['动对象中存在不变量'], operations: ['引入动参数', '消去动参数', '识别不变量'], transforms: ['把动态关系转化为参数无关表达式'] },
  弦长公式: { triggers: ['直线与圆锥曲线相交'], operations: ['联立方程', '判别式约束', '代入弦长公式'], transforms: ['把几何长度转化为根的关系'] },
  全概率公式: { triggers: ['事件由互斥来源组成'], operations: ['划分样本空间', '按来源加权求和'], transforms: ['把总概率拆成条件概率加权和'] },
  贝叶斯公式: { triggers: ['已知结果反推来源'], operations: ['先算全概率', '交换条件方向', '归一化后验概率'], transforms: ['把正向条件概率转化为后验概率'] },
  期望计算: { triggers: ['随机变量或重复试验'], operations: ['确定分布', '概率加权求和'], transforms: ['把随机结果转化为数字特征'] },
}
