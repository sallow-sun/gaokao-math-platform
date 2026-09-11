import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '../views/HomeView.vue'
import { authService } from '../services/authService.js'
import { lastProblemsVisit } from '../services/problemNavigation.js'

async function redirectToCurrentUser(to) {
  try {
    const auth = await authService.me()
    if (auth?.authenticated && auth.user?.id) {
      return { name: 'user-profile', params: { userId: auth.user.id } }
    }
  } catch {
    // The login page will explain an expired or missing session.
  }
  return { name: 'login', query: { redirect: to.fullPath } }
}

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  scrollBehavior(to, from, savedPosition) {
    if (
      !savedPosition &&
      from.name === 'question' &&
      to.fullPath === lastProblemsVisit.path &&
      Date.now() - lastProblemsVisit.at < 120000
    ) {
      savedPosition = { top: lastProblemsVisit.top }
    }
    if (savedPosition)
      return new Promise((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve(savedPosition)))
      })
    if (to.name === 'problems' && from.name === 'problems') return false
    return { top: 0 }
  },
  routes: [
    {
      path: '/paper',
      name: 'paper',
      component: () => import('../views/PaperBuilderView.vue'),
      meta: { studyNavigation: false, title: '自主组卷' },
    },
    {
      path: '/feedback',
      name: 'feedback',
      component: () => import('../views/FeedbackView.vue'),
      meta: { studyNavigation: true, title: '题目反馈' },
    },
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
      component: HomeView,
      beforeEnter: redirectToCurrentUser,
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
      component: HomeView,
      beforeEnter: redirectToCurrentUser,
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
      meta: { requiresAdmin: true, title: '管理后台' },
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

router.beforeEach(async (to) => {
  if (!to.meta.requiresAdmin) return true

  try {
    const auth = await authService.me()
    if (!auth?.authenticated) {
      return { name: 'login', query: { redirect: to.fullPath } }
    }
    if (String(auth.user?.role ?? '').toUpperCase() !== 'ADMIN') {
      return { name: 'problems', query: { adminAccess: 'denied' } }
    }
    return true
  } catch {
    return { name: 'login', query: { redirect: to.fullPath } }
  }
})

router.afterEach((to) => {
  if (typeof document === 'undefined') {
    return
  }

  const pageTitle = String(to.meta.title ?? '').trim()
  document.title = pageTitle ? `${pageTitle} - 数海 MathSea` : '数海 MathSea'
})

export default router
