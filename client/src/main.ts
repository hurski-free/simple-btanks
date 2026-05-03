import { createApp } from 'vue'
import './style.css'
import App from './App.vue'
import { pingApiOnLoad } from './pingApi'

pingApiOnLoad()
createApp(App).mount('#app')
