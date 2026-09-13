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

export const HOME_BACKGROUND_MAX_FILE_SIZE = 2 * 1024 * 1024

/**
 * 系统背景使用 CSS 渐变，不依赖第三方图片服务，也不会产生额外网络请求。
 */
export const HOME_BACKGROUND_OPTIONS = [
  {
    id: 'original',
    name: '原始背景',
    description: '简洁的浅色学习界面',
    image: 'none',
    preview: 'linear-gradient(145deg, #ffffff 0%, #f3f6f8 100%)',
  },
  {
    id: 'lake-blue',
    name: '湖蓝晨雾',
    description: '安静清透的蓝色渐变',
    image:
      'radial-gradient(circle at 18% 20%, rgb(255 255 255 / 80%) 0 12%, transparent 34%), linear-gradient(145deg, #d8edf5 0%, #b9d8e7 46%, #9bbfd4 100%)',
    preview: 'linear-gradient(145deg, #eaf7fb 0%, #b9d8e7 52%, #8fb5cc 100%)',
  },
  {
    id: 'warm-paper',
    name: '暖杏书页',
    description: '柔和温暖的纸张色调',
    image:
      'radial-gradient(circle at 82% 12%, rgb(255 255 255 / 72%) 0 10%, transparent 31%), linear-gradient(150deg, #f7ead7 0%, #e9cfad 55%, #d9b98e 100%)',
    preview: 'linear-gradient(145deg, #fff4e4 0%, #e9cfad 55%, #d2aa79 100%)',
  },
  {
    id: 'green-hills',
    name: '青岚远山',
    description: '舒缓自然的青绿色调',
    image:
      'radial-gradient(ellipse at 25% 12%, rgb(255 255 255 / 66%) 0 11%, transparent 34%), linear-gradient(155deg, #dceee8 0%, #b7d3c8 50%, #91b4a7 100%)',
    preview: 'linear-gradient(145deg, #eaf6f1 0%, #b7d3c8 54%, #86aa9d 100%)',
  },
]
