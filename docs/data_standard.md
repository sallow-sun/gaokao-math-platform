# Problem v1.0设计

## 设计原则

1. 所有题目平等
2. 高考题通过题单组织
3. 改编题作为新题
4. 题解独立于题目


## Problem字段

id：题目id。仅用于题目区分，数字无意义。

title：用户自定义标题。如2025新高考Ⅰ卷数学第11题。

problem_year(optional)：题目年份。

source_type：题目来源。例如官方/模拟题/原创/改编。
official_exam
simulation
original
adapted

question_number(optional)：该题在原卷中的题号。可省略。

question_type：题目类型。单选/多选/填空/解答。

content_latex：题目的latex版本。

training_level：训练价值（难度）。红/橙/黄/绿/青/蓝/紫/黑/白。
分级说明（数字对标高考题号，参照24年新一卷19题）
红：1
橙：4、9
黄：6、10、13
绿：7
青：8、11、14
蓝：18
紫：19
黑：垃圾题（对高考备考毫无帮助的题，例如模拟卷出题人为炫技命制的题目）
白：论外。例如老高考存在，但新高考已经不考察的题。以及强基计划、自招计划试题。

creator_id：上传者。

created_time：上传时间。

## Category字段

id：区分用。无意义。

name：官方类别名称。例如圆锥曲线、导数、解三角形、三角函数。

parent_id(optional)

## Problem_Category字段  \\连接Problem和Category

problem_id：记录题目x

category_id：记录题目x的category

## Tag字段

id：区分用。无意义。

name：tag名称，用以描述题目。如求函数最值、抛物线弦长问题。
1.普通用户：为题目选择已有标签。例如：[√] 含参讨论[√] 分类讨论[ ] 换元
2.高级用户：可以申请新标签，需经过管理员审核。例如：建议增加：tag切线斜率法  理由：适用于导数几何意义问题ids
3.管理员：一个题被多次标记为同一标签，则为之添加该标签。同时合并重复标签，如换元法、变量替换。

## Problem_Tag字段  \\连接Problem和Tag

problem_id：记录题目x

tag_id：记录题目x的tag

## Solution字段

id

problem_id：答案对应的问题的id

author：答案作者（来源）

content：答案内容

status：审核状态

created_time：发布时间

view_count：浏览量统计

like_count：点赞统计

## Method字段

id：区分用。无意义。

name：method名称，用以描述解题方法。如基本不等式、三角换元。

## Solution_Method字段 \\连接Solution和Method

solution_id：记录解答a

method_id：记录解答a的method

## Comment字段

id

solution_id：其留言的帖子（solution）的id

user_id：评论发表者的id

content：评论内容

like_count：点赞统计

## Collection字段 \\题单

id

creator_id：题单创建人id

item_list：题目列表

## Exam字段 \\整张试卷

id

name

problem_year(optional)：题目年份。

item_list：题目列表

source_type：试卷来源。

training_level：训练价值（难度）。


## User字段

id

username

email

role