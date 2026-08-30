import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '../views/HomeView.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: HomeView,
      meta: { studyNavigation: true, title: '首页' },
    },
    {
      path: '/problems',
      name: 'problems',
      component: () => import('../views/ProblemsView.vue'),
      meta: { studyNavigation: true, title: '题库' },
    },
    {
      path: '/problems/:problemNumber',
      name: 'question',
      component: () => import('../views/QuestionView.vue'),
      props: true,
      meta: { studyNavigation: true, title: '题目详情' },
    },
    {
      path: '/training',
      name: 'training',
      component: () => import('../views/TrainingView.vue'),
      meta: { studyNavigation: true, title: '题单' },
    },
    {
      path: '/training/:practiceListId',
      name: 'training-detail',
      component: () => import('../views/TrainingDetailView.vue'),
      props: true,
      meta: { studyNavigation: true, title: '题单详情' },
    },
    {
      path: '/login',
      name: 'login',
      component: () => import('../views/LoginView.vue'),
      meta: { title: '登录账号' },
    },
    {
      path: '/register',
      name: 'register',
      component: () => import('../views/RegisterView.vue'),
      meta: { title: '创建账号' },
    },
    {
      path: '/forgot',
      name: 'forgot-password',
      component: () => import('../views/ForgotPasswordView.vue'),
      meta: { title: '找回密码' },
    },
    {
      path: '/user/settings/profile',
      name: 'user-settings-profile',
      redirect: { name: 'user-profile', params: { userId: 'preview' } },
      meta: { studyNavigation: true, title: '个人主页' },
    },
    {
      path: '/user/settings/preferences',
      name: 'user-settings-preferences',
      component: () => import('../views/UserSettingsView.vue'),
      props: { activeTab: 'preferences' },
      meta: { studyNavigation: true, title: '偏好设置' },
    },
    {
      path: '/user/settings/security',
      name: 'user-settings-security',
      component: () => import('../views/UserSettingsView.vue'),
      props: { activeTab: 'security' },
      meta: { studyNavigation: true, title: '安全设置' },
    },
    {
      path: '/user',
      name: 'user-profile-missing',
      redirect: { name: 'user-profile', params: { userId: 'preview' } },
      meta: { studyNavigation: true, title: '个人主页' },
    },
    {
      path: '/user/:userId',
      name: 'user-profile',
      component: () => import('../views/UserProfileView.vue'),
      props: true,
      meta: { studyNavigation: true, title: '个人主页' },
    },
    {
      path: '/admin',
      name: 'admin',
      component: () => import('../views/AdminView.vue'),
      meta: { title: '管理后台' },
    },
    {
      path: '/about',
      name: 'about',
      // route level code-splitting
      // this generates a separate chunk (About.[hash].js) for this route
      // which is lazy-loaded when the route is visited.
      component: () => import('../views/AboutView.vue'),
      meta: { title: '关于' },
    },
  ],
})

router.afterEach((to) => {
  if (typeof document === 'undefined') {
    return
  }

  const pageTitle = String(to.meta.title ?? '').trim()
  document.title = pageTitle ? `${pageTitle} - 数海 MathSea` : '数海 MathSea'
})

export default router
