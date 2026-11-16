import { createApp } from 'vue'
import App from './App.vue'
import router from './router.js'
import './styles/theme.css'
import './styles/vue-app.css'

createApp(App).use(router).mount('#app')
