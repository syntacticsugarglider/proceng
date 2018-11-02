import Vue from 'vue';
import App from './App.vue';

import Player from './player/main';

const player = new Player();

Vue.config.productionTip = false;

new Vue({
  render: (h) => h(App)
}).$mount('#app');
