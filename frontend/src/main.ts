import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'

const app = createApp(App)

app.config.errorHandler = (err, _instance, info) => {
  console.error('Unhandled error:', err, info)
}

app.use(createPinia())
app.use(router)

app.mount('#app')
