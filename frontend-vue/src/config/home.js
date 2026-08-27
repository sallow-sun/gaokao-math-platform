/**
 * 首页相关地址集中放在这里。
 * 后续后端接口或 Vue Router 路径调整时，只需要修改本文件。
 */
export const HOME_ROUTES = {
  normalHome: '/home',
  problems: '/problems',
  training: '/training',
  about: '/about',
  help: '/help',
  question(problemId) {
    return {
      name: 'question',
      params: { problemNumber: String(problemId ?? '').trim() },
    }
  },
}

/**
 * 当前仍使用旧首页里的演示题号。
 * 接入后端后，可以改为请求“随机题目”接口。
 */
export const RANDOM_PROBLEM_IDS = ['P10001', 'P10002']
