/* Load the Live2D runtime only on viewports where the mascot is rendered. */
(function () {
  'use strict';

  var MOBILE_MAX_WIDTH = 768;
  var SCRIPTS = [
    '/js/vendor/pixi.min.js',
    '/js/vendor/live2dcubismcore.min.js',
    '/js/vendor/pixi-live2d-display-cubism4.min.js',
    '/js/live2d-mascot.js?v=1.6.1'
  ];

  if (window.matchMedia('(max-width: ' + MOBILE_MAX_WIDTH + 'px)').matches) return;

  function loadNext(index) {
    if (index >= SCRIPTS.length) return;

    var script = document.createElement('script');
    script.src = SCRIPTS[index];
    script.async = false;
    script.onload = function () {
      loadNext(index + 1);
    };
    script.onerror = function () {
      console.warn('[live2d-loader] failed to load ' + SCRIPTS[index]);
    };
    document.head.appendChild(script);
  }

  loadNext(0);
})();
