<template>
  <div v-if="showNonWidgetMessage">Não widget</div>
  <VuetifyWithOOTB />
  <OOTBpropertyPage />
</template>

<script setup>
import { onMounted, ref } from 'vue'
import VuetifyWithOOTB from './VuetifyWithOOTB.vue'
import OOTBpropertyPage from './OOTBpropertyPage.vue'

const showNonWidgetMessage = ref(false)

// Methods
function someMethod() {
  console.log('This is a method')
}

// Lifecycle hook
onMounted(() => {
  if ('widget' in globalThis) {
    console.debug('Widget:', globalThis.widget)
  } else {
    console.debug('Widget global não disponível (dev)')
    showNonWidgetMessage.value = true
  }
  someMethod() // Call the method inside mounted
})
</script>

<!-- Global styles for the app -->
<style>
html {
  overflow-y: auto !important;
  overflow-x: hidden !important;
}
</style>
