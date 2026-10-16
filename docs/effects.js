/* progress bar, fade-in on scroll, home page effects */

(function () {
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  document.addEventListener('DOMContentLoaded', function () {
    progressBar();
    var hero = document.querySelector('.quarto-about-jolla');
    if (hero) home(hero); else reveal();
  });

  /* ---------- reading progress + navbar scroll state ---------- */
  function progressBar() {
    var bar = document.createElement('div');
    bar.className = 'reading-progress';
    document.body.appendChild(bar);
    var header = document.getElementById('quarto-header');
    function update() {
      var h = document.documentElement.scrollHeight - window.innerHeight;
      var p = h > 0 ? window.scrollY / h : 0;
      bar.style.transform = 'scaleX(' + p + ')';
      if (header) header.classList.toggle('scrolled', window.scrollY > 10);
    }
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    update();
  }

  /* ---------- fade-up of content blocks on inner pages ---------- */
  function reveal() {
    var main = document.querySelector('main.content');
    if (!main || reduce || !('IntersectionObserver' in window)) return;
    var items = main.querySelectorAll(':scope > *:not(script):not(style), :scope > section > *');
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add('shown'); io.unobserve(e.target); }
      });
    }, { rootMargin: '0px 0px -8% 0px' });
    var n = 0;
    items.forEach(function (el) {
      if (el.tagName === 'SECTION') return;
      el.classList.add('reveal');
      el.style.setProperty('--reveal-delay', Math.min(n++, 6) * 0.06 + 's');
      io.observe(el);
    });
  }

  /* ---------- home ---------- */
  function home(hero) {
    document.body.classList.add('home');
    background();
    typewriter(hero);
    bell(hero);
    hero.querySelectorAll('.about-link').forEach(function (a, i) {
      a.style.setProperty('--i', i);
    });
  }

  function background() {
    var bg = document.createElement('div');
    bg.className = 'hero-bg';
    bg.setAttribute('aria-hidden', 'true');
    bg.innerHTML = '<div class="blob b1"></div><div class="blob b2"></div>' +
                   '<div class="blob b3"></div><canvas></canvas><div class="spotlight"></div>';
    document.body.prepend(bg);

    window.addEventListener('pointermove', function (e) {
      bg.style.setProperty('--mx', e.clientX + 'px');
      bg.style.setProperty('--my', e.clientY + 'px');
    }, { passive: true });

    galton(bg.querySelector('canvas'));
  }

  /* background: a Galton board; part of the histogram is already there on load,
     then a short burst of balls bounces through the pegs, thinning after a few seconds into
     an irregular trickle of one or two balls at a time that keeps filling it */
  function galton(cv) {
    var ctx = cv.getContext('2d');
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var R = 22, N = 1400, start = 600, rate = 7, hop = 85, peak = .22, burst = 4500, most = 2;
    /* peg rows, balls that fill the tallest bar up to 'peak' (share of height), balls already in place,
       new balls per second during the initial burst, ms per row, burst length (ms), max balls in flight afterwards */
    var W, H, dx, dy, y0, yb, unit, total = 0, bins = [], balls = [], acc = 0, last = null, t = 0, next = 0;
    for (var j = 0; j <= R; j++) bins.push(0);

    /* expected share of balls in the central bin: choose(R, R/2) / 2^R */
    var share = 1;
    for (j = 1; j <= R / 2; j++) share *= (R / 2 + j) / j / 4;

    function px(k, i) { return W / 2 + (i - k / 2) * dx; }   /* x of peg i in row k (row R = bins) */
    function py(k) { return k >= R ? yb : y0 + k * dy; }

    function resize() {
      W = window.innerWidth; H = window.innerHeight;
      cv.width = W * dpr; cv.height = H * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      dx = Math.min(34, W / (R + 3));
      y0 = H * .12;
      dy = H * .6 / R;
      yb = y0 + (R - .4) * dy;
      scale();
      paint();
    }

    /* bars grow until N balls have landed, then the histogram is rescaled to stay the same height */
    function scale() { unit = peak * H / (Math.max(N, total) * share); }

    function binomial() {
      var bin = 0;
      for (var k = 0; k < R; k++) bin += Math.random() < .5 ? 0 : 1;
      return bin;
    }

    function paint() {
      var k, i, h, x;
      ctx.clearRect(0, 0, W, H);
      /* pegs */
      ctx.fillStyle = 'rgba(154,0,0,.2)';
      for (k = 0; k < R; k++) for (i = 0; i <= k; i++) {
        ctx.beginPath(); ctx.arc(px(k, i), py(k), 1.6, 0, Math.PI * 2); ctx.fill();
      }
      /* bin walls */
      ctx.fillStyle = 'rgba(154,0,0,.08)';
      for (i = 0; i <= R + 1; i++) ctx.fillRect(px(R, i) - dx / 2, yb, 1, H - yb);
      /* histogram */
      for (i = 0; i <= R; i++) {
        h = bins[i] * unit;
        if (h <= 0) continue;
        x = px(R, i) - dx / 2;
        ctx.fillStyle = 'rgba(154,0,0,.06)';
        ctx.fillRect(x + 2, H - h, dx - 3, h);
        ctx.fillStyle = 'rgba(200,162,107,.38)';
        ctx.fillRect(x + 2, H - h, dx - 3, 1);
      }
      /* balls */
      for (i = 0; i < balls.length; i++) {
        var b = balls[i], bx, by;
        if (b.fall) { bx = px(R, b.i); by = b.y; }
        else {
          var x1 = b.k < 0 ? W / 2 : px(b.k, b.i), y1 = b.k < 0 ? y0 - 2 * dy : py(b.k);
          bx = x1 + (px(b.k + 1, b.ni) - x1) * b.p;
          by = y1 + (py(b.k + 1) - y1) * b.p - Math.sin(Math.PI * b.p) * dy * .35;
        }
        ctx.fillStyle = b.gold ? 'rgba(200,162,107,.85)' : 'rgba(154,0,0,.45)';
        ctx.beginPath(); ctx.arc(bx, by - 3, 2.2, 0, Math.PI * 2); ctx.fill();
      }
    }

    function drop() { balls.push({ k: -1, i: 0, ni: 0, p: 0, gold: Math.random() < .25 }); }

    function frame(now) {
      if (last === null) last = now;
      var dt = Math.min(50, now - last), i;
      last = now; t += dt;
      if (t < burst) for (acc += dt * rate / 1000; acc >= 1; acc--) drop();
      else if (t >= next) {
        /* irregular gaps: mostly 0.6-2.4 s, sometimes a quick second ball */
        if (balls.length < most) drop();
        next = t + (Math.random() < .2 ? 150 + Math.random() * 250 : 600 + Math.random() * 1800);
      }
      for (i = balls.length - 1; i >= 0; i--) {
        var b = balls[i];
        if (b.fall) {
          b.v += .15; b.y += b.v;
          if (b.y >= H - bins[b.i] * unit) { bins[b.i]++; total++; scale(); balls.splice(i, 1); }
          continue;
        }
        b.p += dt / hop;
        if (b.p >= 1) {
          b.k++; b.i = b.ni; b.p = 0;
          if (b.k >= R) { b.fall = true; b.y = yb; b.v = 1; }
          else b.ni = b.i + (Math.random() < .5 ? 0 : 1);
        }
      }
      paint();
      requestAnimationFrame(frame);
    }

    for (var n = 0; n < (reduce ? N : start); n++) bins[binomial()]++;
    total = reduce ? N : start;
    window.addEventListener('resize', resize);
    resize();
    if (!reduce) setTimeout(function () { requestAnimationFrame(frame); }, 600);
  }

  /* the intro text types itself on load */
  function typewriter(hero) {
    var p = hero.querySelector('main.content > p');
    if (!p || reduce || p.children.length) return;
    var text = p.textContent.trim(), c = 0;
    p.setAttribute('aria-label', text);
    p.classList.add('typing');
    p.innerHTML = '<span class="typed" aria-hidden="true"></span><span class="caret" aria-hidden="true"></span>' +
                  '<span class="untyped" aria-hidden="true"></span>';
    var typed = p.querySelector('.typed'), untyped = p.querySelector('.untyped');
    untyped.textContent = text;
    setTimeout(function tick() {
      c = Math.min(text.length, c + 2);
      typed.textContent = text.slice(0, c);
      untyped.textContent = text.slice(c);
      if (c < text.length) setTimeout(tick, /[.,]/.test(text[c - 1]) ? 160 : 22);
      else setTimeout(function () { p.classList.add('done'); }, 2500);
    }, 900);
  }

  /* gaussian curve drawn in place of the separator, with a dot travelling along it */
  function bell(hero) {
    var sep = hero.querySelector('.about-sep');
    if (!sep) return;
    var Wd = 340, Hd = 70, pts = [];
    for (var i = 0; i <= 80; i++) {
      var z = -3.2 + 6.4 * i / 80;
      pts.push([(i / 80 * Wd).toFixed(1), (Hd - 4 - (Hd - 10) * Math.exp(-z * z / 2)).toFixed(1)]);
    }
    var d = 'M' + pts.map(function (p) { return p.join(','); }).join(' L');
    var svg =
      '<svg class="bell-curve" viewBox="0 0 ' + Wd + ' ' + Hd + '" aria-hidden="true">' +
      '<defs>' +
      '<linearGradient id="bellStroke" x1="0" x2="1"><stop offset="0" stop-color="#9a0000" stop-opacity=".2"/>' +
      '<stop offset=".5" stop-color="#9a0000"/><stop offset=".62" stop-color="#c8a26b"/><stop offset="1" stop-color="#9a0000" stop-opacity=".2"/></linearGradient>' +
      '<linearGradient id="bellFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#9a0000" stop-opacity=".14"/>' +
      '<stop offset="1" stop-color="#9a0000" stop-opacity="0"/></linearGradient>' +
      '</defs>' +
      '<path class="area" d="' + d + ' L' + Wd + ',' + Hd + ' L0,' + Hd + ' Z"/>' +
      '<line class="axis" x1="0" y1="' + (Hd - .5) + '" x2="' + Wd + '" y2="' + (Hd - .5) + '"/>' +
      '<path class="curve" pathLength="1" d="' + d + '"/>' +
      (reduce ? '' : '<circle class="dot" r="3.2" opacity="0"><set attributeName="opacity" to="1" begin="3s"/><animateMotion dur="7s" begin="3s" repeatCount="indefinite" ' +
        'keyPoints="0;1;0" keyTimes="0;.5;1" calcMode="spline" keySplines=".45 0 .55 1;.45 0 .55 1" path="' + d + '"/></circle>') +
      '</svg>';
    sep.insertAdjacentHTML('afterend', svg);
  }
})();
