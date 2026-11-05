/**
 * Vercel Speed Insights initialization
 * This module loads and initializes Speed Insights for performance tracking
 */

// Initialize the queue early
window.si = window.si || function() {
  (window.siq = window.siq || []).push(arguments);
};

// Load the Speed Insights script
(function() {
  // Check if script already loaded
  if (document.querySelector('script[data-speed-insights]')) return;
  
  // Detect environment
  const isDev = window.location.hostname === 'localhost' || 
                window.location.hostname === '127.0.0.1';
  
  // Speed Insights script URL
  const scriptSrc = isDev 
    ? 'https://va.vercel-scripts.com/v1/speed-insights/script.debug.js'
    : '/_vercel/speed-insights/script.js';
  
  // Create and configure script element
  const script = document.createElement('script');
  script.src = scriptSrc;
  script.defer = true;
  script.dataset.speedInsights = 'true';
  script.dataset.sdkn = '@vercel/speed-insights';
  script.dataset.sdkv = '2.1.0';
  
  // Error handler
  script.onerror = function() {
    console.log('[Vercel Speed Insights] Failed to load script from ' + scriptSrc + 
                '. Please check if any content blockers are enabled and try again.');
  };
  
  // Append to document head
  document.head.appendChild(script);
})();
