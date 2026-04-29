/**
 * Analytics Debug Helper
 * Use this to troubleshoot analytics issues
 */

// Check if GTM is loaded
export function checkGTMStatus() {
  console.log('=== GTM Status Check ===');
  console.log('GTM loaded:', typeof window.google_tag_manager !== 'undefined');
  console.log('dataLayer exists:', typeof window.dataLayer !== 'undefined');
  console.log('dataLayer length:', window.dataLayer?.length || 0);

  if (window.dataLayer) {
    console.log('Recent dataLayer events:', window.dataLayer.slice(-5));
  }
}

// Check if gtag is loaded
export function checkGtagStatus() {
  console.log('=== gtag Status Check ===');
  console.log('gtag loaded:', typeof window.gtag !== 'undefined');
  console.log('ga loaded:', typeof window.ga !== 'undefined');
}

// Test sending an event
export function sendTestEvent() {
  console.log('=== Sending Test Event ===');

  if (typeof window.dataLayer !== 'undefined') {
    window.dataLayer.push({
      event: 'test_event',
      event_name: 'test_event',
      category: 'debug',
      timestamp: new Date().toISOString()
    });
    console.log('✅ Test event pushed to dataLayer');
  } else {
    console.error('❌ dataLayer not found');
  }
}

// Monitor all dataLayer pushes
export function monitorDataLayer() {
  if (typeof window.dataLayer === 'undefined') {
    console.error('❌ dataLayer not found');
    return;
  }

  console.log('=== Monitoring dataLayer ===');
  const originalPush = window.dataLayer.push;

  window.dataLayer.push = function(...args) {
    console.log('📊 dataLayer.push:', args);
    return originalPush.apply(window.dataLayer, args);
  };

  console.log('✅ dataLayer monitoring enabled');
}

// Get analytics service stats
export function getAnalyticsStats() {
  if (window.analyticsService) {
    const stats = window.analyticsService.getEventStats();
    console.log('=== Analytics Stats ===');
    console.log(stats);
    return stats;
  } else {
    console.error('❌ analyticsService not found');
  }
}

// Run all checks
export function runAllChecks() {
  checkGTMStatus();
  checkGtagStatus();
  getAnalyticsStats();
  console.log('\n💡 Try running: sendTestEvent()');
  console.log('💡 Try running: monitorDataLayer()');
}

// Make functions available globally for console access
if (typeof window !== 'undefined') {
  window.analyticsDebug = {
    checkGTM: checkGTMStatus,
    checkGtag: checkGtagStatus,
    sendTest: sendTestEvent,
    monitor: monitorDataLayer,
    getStats: getAnalyticsStats,
    runAll: runAllChecks
  };

  console.log('📊 Analytics Debug Helper loaded!');
  console.log('Run: analyticsDebug.runAll() to check everything');
}
