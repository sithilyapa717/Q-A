(function () {
  if (document.querySelector('.page-bg-root')) {
    return;
  }

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const narrow = window.matchMedia('(max-width: 640px)').matches;
  const touchCoarse = window.matchMedia('(hover: none) and (pointer: coarse)').matches;
  const lite = reducedMotion || narrow || touchCoarse;

  const highPerf =
    !lite &&
    window.matchMedia('(min-width: 641px) and (hover: hover)').matches;

  const root = document.createElement('div');
  root.className = 'page-bg-root' + (lite ? ' page-bg-root--lite' : '');
  root.setAttribute('aria-hidden', 'true');

  if (lite) {
    root.innerHTML =
      '<div class="page-bg">' +
        '<div class="page-bg-glow page-bg-glow-1"></div>' +
      '</div>' +
      '<div class="stripes"></div>';
    document.documentElement.classList.add('vv-mobile');
  } else {
    root.innerHTML =
      '<div class="page-bg">' +
        '<div class="page-bg-glow page-bg-glow-1"></div>' +
        '<div class="page-bg-glow page-bg-glow-2"></div>' +
      '</div>' +
      '<div class="page-bg-shapes">' +
        '<span></span><span></span><span></span>' +
        '<span></span><span></span><span></span>' +
      '</div>' +
      '<div class="page-bg-pebbles">' +
        '<span></span><span></span><span></span>' +
        '<span></span><span></span><span></span>' +
      '</div>' +
      '<div class="page-bg-ripples">' +
        '<div class="bg-ripple-group"><span></span><span></span></div>' +
        '<div class="bg-ripple-group"><span></span><span></span></div>' +
        '<div class="bg-ripple-group"><span></span><span></span></div>' +
      '</div>' +
      '<div class="stripes"></div>';
  }

  if (highPerf) {
    document.documentElement.classList.add('vv-perf');
    root.classList.add('page-bg-root--perf');
  }

  document.body.insertBefore(root, document.body.firstChild);
})();
