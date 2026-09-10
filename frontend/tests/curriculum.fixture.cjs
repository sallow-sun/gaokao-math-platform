const books = [
  ['必修第一册', ['集合与常用逻辑用语','一元二次函数、方程和不等式','函数的概念与性质','指数函数与对数函数','三角函数']],
  ['必修第二册', ['平面向量及其应用','复数','立体几何初步','统计','概率']],
  ['选择性必修第一册', ['空间向量与立体几何','直线和圆的方程','圆锥曲线的方程']],
  ['选择性必修第二册', ['数列','一元函数的导数及其应用']],
  ['选择性必修第三册', ['计数原理','随机变量及其分布','成对数据的统计分析']],
]
const chapters = books.flatMap(([book,titles], b) => titles.map((title,c)=>({code:`A${b+1}${c+1}`,book,title,book_order:b+1})))
module.exports = {version:'PEP-A-2019',label:'人教A版（2019）',chapters,presets:[5,10,14,18,18,18].map((n,i)=>({id:`semester-${i+1}`,label:['学完高一上','学完高一下','学完高二上','学完高二下','学完高三上','学完高三下'][i],chapters:chapters.slice(0,n).map(c=>c.code),version:1}))}
