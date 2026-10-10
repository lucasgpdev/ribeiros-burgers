/**
 * render.js — cria o HTML dinâmico a partir de data/ingredients.js e data/menu.js:
 *   • as 9 camadas independentes do hambúrguer (#burger)
 *   • as legendas ao lado das camadas (#captions)
 *   • os cards de ingredientes e do cardápio
 * Expõe window.BurgerRender para o módulo de animação.
 */
(function () {
  "use strict";

  var BOX = window.BURGER_BOX;
  var brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

  /* ---------- Limpeza de fotos JPG (fundo branco → transparente) ----------
   * JPG não tem transparência, então uma foto de ingrediente chega com um retângulo branco.
   * Aqui o fundo é removido no navegador (só a parte branca/cinza ligada à borda da foto),
   * a imagem é recortada rente ao ingrediente e a proporção é devolvida para a camada se ajustar.
   * Funciona com o site aberto por servidor (Live Server, http.server, hospedagem). Abrindo o
   * index.html direto do disco (file://) o navegador bloqueia a leitura dos pixels; nesse caso a
   * foto é exibida como está. O ideal continua sendo entregar PNG transparente.
   */
  var cleanCache = {};

  function isSvg(url) { return /\.svg(\?|#|$)/i.test(url || ""); }

  function cleanPhoto(img) {
    var MAX = 1400;
    var s = Math.min(1, MAX / Math.max(img.naturalWidth, img.naturalHeight));
    var w = Math.round(img.naturalWidth * s), h = Math.round(img.naturalHeight * s);
    var canvas = document.createElement("canvas");
    canvas.width = w; canvas.height = h;
    var ctx = canvas.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(img, 0, 0, w, h);
    var imageData = ctx.getImageData(0, 0, w, h); // lança erro se a imagem estiver "bloqueada" (file://)
    var px = imageData.data;
    var T = 232; // acima disso o pixel é considerado branco

    // "fundo" = transparente, branco, cinza sem cor (sombra) ou branco-rosado (sobra de recorte).
    // Só é removido o que estiver ligado à borda da imagem; o miolo do ingrediente é preservado.
    function isBackdrop(p) {
      var i = p * 4, r = px[i], g = px[i + 1], b = px[i + 2];
      if (px[i + 3] < 16) return true;
      var lo = Math.min(r, g, b), hi = Math.max(r, g, b);
      if (lo >= T) return true;
      if (hi - lo < 22 && lo >= 140) return true;
      return lo >= 205 && hi - lo < 45 && (g - b) < 12 && r >= g;
    }

    // Preenchimento a partir das bordas: só remove fundo ligado ao contorno da foto
    var bg = new Uint8Array(w * h);
    var stack = new Int32Array(w * h);
    var sp = 0;
    function push(p) { if (!bg[p] && isBackdrop(p)) { bg[p] = 1; stack[sp++] = p; } }
    var x, y;
    for (x = 0; x < w; x++) { push(x); push((h - 1) * w + x); }
    for (y = 0; y < h; y++) { push(y * w); push(y * w + w - 1); }
    while (sp) {
      var p = stack[--sp];
      var px0 = p % w;
      if (px0 > 0) push(p - 1);
      if (px0 < w - 1) push(p + 1);
      if (p >= w) push(p - w);
      if (p < w * (h - 1)) push(p + w);
    }

    // Suaviza a borda (anti-serrilhado) e tira o halo branco dos pixels de contorno
    var minX = w, minY = h, maxX = -1, maxY = -1;
    for (y = 0; y < h; y++) {
      for (x = 0; x < w; x++) {
        var q = y * w + x, i = q * 4;
        if (bg[q]) { px[i + 3] = 0; continue; }
        var nearBg = (x > 0 && bg[q - 1]) || (x < w - 1 && bg[q + 1]) || (y > 0 && bg[q - w]) || (y < h - 1 && bg[q + w]);
        if (nearBg) {
          var lo = Math.min(px[i], px[i + 1], px[i + 2]);
          var a = Math.max(0, Math.min(1, (255 - lo) / 65));
          if (a < 0.02) { px[i + 3] = 0; continue; }
          for (var c = 0; c < 3; c++) px[i + c] = Math.max(0, Math.min(255, (px[i + c] - 255 * (1 - a)) / a));
          px[i + 3] = Math.min(px[i + 3], Math.round(a * 255));
        }
        if (px[i + 3] > 10) {
          if (x < minX) minX = x; if (x > maxX) maxX = x;
          if (y < minY) minY = y; if (y > maxY) maxY = y;
        }
      }
    }
    if (maxX < 0) return Promise.reject(new Error("imagem sem conteúdo"));

    ctx.putImageData(imageData, 0, 0);
    var cw = maxX - minX + 1, ch = maxY - minY + 1;
    var out = document.createElement("canvas");
    out.width = cw; out.height = ch;
    out.getContext("2d").drawImage(canvas, minX, minY, cw, ch, 0, 0, cw, ch);

    return new Promise(function (resolve, reject) {
      out.toBlob(function (blob) {
        if (!blob) return reject(new Error("falha ao gerar imagem"));
        resolve({ url: URL.createObjectURL(blob), aspect: cw / ch });
      }, "image/png");
    });
  }

  function cleanPhotoCached(img) {
    var key = img.currentSrc || img.src;
    if (!cleanCache[key]) cleanCache[key] = cleanPhoto(img);
    return cleanCache[key];
  }

  /**
   * <img> que tenta o arquivo final (PNG/JPG) e cai no SVG provisório se ele não existir.
   * Com clean = true, fotos JPG têm o fundo removido. img.ready resolve quando a imagem final está pronta.
   */
  function createImage(src, fallback, alt, eager, clean) {
    var img = new Image();
    img.alt = alt || "";
    img.decoding = "async";
    img.loading = eager ? "eager" : "lazy";
    img.draggable = false;

    img.ready = new Promise(function (resolve) {
      function settle() { resolve(img); }
      img.addEventListener("load", function () {
        if (img.dataset.cleaned) return settle();
        if (clean && !isSvg(img.currentSrc || img.src)) {
          cleanPhotoCached(img).then(function (res) {
            img.dataset.cleaned = "1";
            img.dataset.aspect = String(res.aspect);
            img.src = res.url; // dispara "load" de novo → settle()
          }).catch(function (err) {
            console.warn("Não foi possível remover o fundo da foto (" + (img.currentSrc || img.src) + "). " +
              "Abra o site por um servidor (Live Server / http.server) ou use PNG transparente.", err);
            settle();
          });
        } else {
          settle();
        }
      });
      img.addEventListener("error", function () {
        if (!img.dataset.usedFallback && fallback) {
          img.dataset.usedFallback = "1";
          img.src = fallback;
        } else {
          settle();
        }
      });
    });

    img.src = src;
    return img;
  }

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  /* ---------- 1. Camadas do hambúrguer ---------- */
  var burger = document.getElementById("burger");
  var layerEls = [];
  var layerPromises = [];

  window.INGREDIENTS.forEach(function (item, i) {
    var layer = el("div", "layer");
    layer.dataset.layer = item.id;
    layer.style.top = (item.y / BOX.h * 100) + "%";
    layer.style.height = (item.h / BOX.h * 100) + "%";
    layer.style.zIndex = String(20 - i); // camadas de cima ficam à frente nas sobreposições

    var img = createImage(item.image, item.fallback, "", true, true);
    layer.appendChild(img);
    burger.appendChild(layer);
    layerEls.push(layer);

    // Foto recortada: a altura da camada segue a proporção da foto (ver fitLayerToPhoto).
    layerPromises.push(img.ready.then(function () {
      var aspect = parseFloat(img.dataset.aspect);
      if (aspect) { fitLayerToPhoto(item, layer, img, aspect); fittedCount++; }
    }));
  });

  var fittedCount = 0;

  /**
   * Dimensiona a camada pela proporção da foto recortada.
   *   item.width  (0–1, opcional) fração da largura do hambúrguer que a camada ocupa. Padrão 1.
   *   item.squash (0–1, opcional) "achata" a camada na vertical: 0.7 = 30% mais fina (a foto é
   *                               esticada na horizontal, sem diminuir a largura). Use para carnes grossas.
   */
  function fitLayerToPhoto(item, layer, img, aspect) {
    var ratio = item.width || 1;
    var squash = item.squash || 1;
    item._y0 = item.y; item._h0 = item.h;                // valores originais (para o modo manual)
    item._ratio = ratio;
    item.h = BOX.w * ratio / aspect * squash;
    if (squash !== 1) img.style.objectFit = "fill";      // permite achatar sem diminuir a largura
    layer.style.height = (item.h / BOX.h * 100) + "%";
    if (ratio !== 1) {
      layer.style.left = ((1 - ratio) / 2 * 100) + "%";
      layer.style.width = (ratio * 100) + "%";
    }
  }

  /**
   * Com fotos reais as camadas têm alturas diferentes das provisórias. Aqui:
   *   1. empilha as camadas (com leve sobreposição) e centraliza o hambúrguer na caixa;
   *   2. reduz tudo proporcionalmente se o hambúrguer ficar mais alto que a tela comporta;
   *   3. calcula o quanto cada camada sobe/desce, mantendo um vão fixo entre elas
   *      (camadas grossas se afastam mais que as finas, sem se sobrepor).
   * Desligue com window.AUTO_LAYOUT = false (data/ingredients.js) para usar y/h/explode manuais.
   *   item.overlap (opcional) = quanto esta camada entra na de cima, em unidades.
   *   item.gap     (opcional) = vão após separar (padrão 60 no desktop, 24 no celular).
   */
  function autoLayout() {
    var items = window.INGREDIENTS, n = items.length, MAX_STACK = 640;

    function stack() {
      items.forEach(function (it, i) {
        if (i === 0) { it.y = 0; return; }
        var prev = items[i - 1];
        var ov = it.overlap != null ? it.overlap : 0.15 * Math.min(prev.h, it.h);
        it.y = prev.y + prev.h - ov;
      });
      return items[n - 1].y + items[n - 1].h - items[0].y;
    }

    var total = stack();
    if (total > MAX_STACK) {                             // cabe na tela: encolhe tudo por igual
      var k = MAX_STACK / total;
      items.forEach(function (it) { it.h *= k; it._ratio = (it._ratio || 1) * k; });
      total = stack();
    }
    var shift = BOX.h / 2 - (items[0].y + total / 2);
    items.forEach(function (it) { it.y += shift; });

    var pivot = 0;
    items.forEach(function (it, i) { if (it.id === "beef-patty") pivot = i; });
    function explodeSet(gapOf) {
      var ey = [];
      ey[pivot] = items[pivot].y;
      for (var i = pivot - 1; i >= 0; i--) ey[i] = ey[i + 1] - gapOf(items[i]) - items[i].h;
      for (var j = pivot + 1; j < n; j++) ey[j] = ey[j - 1] + items[j - 1].h + gapOf(items[j]);
      return ey.map(function (v, idx) { return v - items[idx].y; });
    }
    var desk = explodeSet(function (it) { return it.gap != null ? it.gap : 60; });
    var mob = explodeSet(function (it) { return it.gap != null ? it.gap * 0.4 : 24; });
    items.forEach(function (it, i) { it.explode = desk[i]; it.explodeMobile = mob[i]; });

    items.forEach(function (it, i) {
      var layer = layerEls[i];
      layer.style.top = (it.y / BOX.h * 100) + "%";
      layer.style.height = (it.h / BOX.h * 100) + "%";
      var r = it._ratio || 1;
      layer.style.left = ((1 - r) / 2 * 100) + "%";
      layer.style.width = (r * 100) + "%";
    });
  }

  /** Modo manual: mantém uma borda da camada parada ao trocar a altura pela da foto. */
  function manualLayout() {
    var items = window.INGREDIENTS, last = items.length - 1;
    items.forEach(function (it, i) {
      if (it._h0 == null) return;
      var anchor = it.anchor || (i === 0 ? "bottom" : i === last ? "top" : "center");
      it.y = anchor === "bottom" ? it._y0 + it._h0 - it.h
           : anchor === "top" ? it._y0
           : it._y0 + it._h0 / 2 - it.h / 2;
      layerEls[i].style.top = (it.y / BOX.h * 100) + "%";
    });
  }

  var imagesReady = Promise.all(layerPromises).then(function () {
    if (!fittedCount) return;                            // só desenhos provisórios: nada a ajustar
    if (window.AUTO_LAYOUT === false) manualLayout(); else autoLayout();
  });


  /* ---------- 2. Legendas ao lado das camadas ---------- */
  var captionsWrap = document.getElementById("captions");
  var captionEls = window.INGREDIENTS.map(function (item, i) {
    var cap = el("article", "caption " + (i % 2 === 0 ? "caption--left" : "caption--right"));
    cap.dataset.caption = item.id;
    cap.appendChild(el("p", "caption__num", "Camada " + item.number));
    cap.appendChild(el("h3", "caption__name", item.name));
    cap.appendChild(el("p", "caption__text", item.short));
    captionsWrap.appendChild(cap);
    return cap;
  });

  /* ---------- 3. Cards de ingredientes ---------- */
  var cardsWrap = document.getElementById("ingredient-cards");
  window.INGREDIENTS.forEach(function (item) {
    var li = el("li", "card");
    li.setAttribute("data-reveal", "");
    li.appendChild(el("span", "card__num", item.number));
    var media = el("div", "card__media");
    media.appendChild(createImage(item.image, item.fallback, "Ilustração: " + item.name, false, true));
    li.appendChild(media);
    li.appendChild(el("p", "card__label", "Camada " + item.number));
    li.appendChild(el("h3", "card__name", item.name));
    li.appendChild(el("p", "card__text", item.long));
    cardsWrap.appendChild(li);
  });

  /* ---------- 4. Cardápio ---------- */
  var menuWrap = document.getElementById("menu-grid");
  window.MENU_ITEMS.forEach(function (item) {
    var li = el("li", "menu-card");
    li.setAttribute("data-reveal", "");

    var media = el("div", "menu-card__media");
    media.appendChild(createImage(item.image, item.fallback, item.name, false));
    li.appendChild(media);

    var body = el("div", "menu-card__body");
    var top = el("div", "menu-card__top");
    top.appendChild(el("h3", "menu-card__name", item.name));
    top.appendChild(el("span", "menu-card__price", brl.format(item.price)));
    body.appendChild(top);
    body.appendChild(el("p", "menu-card__desc", item.description));

    var btn = el("button", "btn btn--ghost", "Conhecer hambúrguer");
    btn.type = "button";
    btn.dataset.menuId = item.id;
    btn.setAttribute("aria-label", "Conhecer hambúrguer " + item.name);
    body.appendChild(btn);

    li.appendChild(body);
    menuWrap.appendChild(li);
  });

  window.BurgerRender = {
    createImage: createImage,
    brl: brl,
    layers: layerEls,
    captions: captionEls,
    imagesReady: imagesReady
  };
})();/**
 * render.js — cria o HTML dinâmico a partir de data/ingredients.js e data/menu.js:
 *   • as 9 camadas independentes do hambúrguer (#burger)
 *   • as legendas ao lado das camadas (#captions)
 *   • os cards de ingredientes e do cardápio
 * Expõe window.BurgerRender para o módulo de animação.
 */
(function () {
  "use strict";

  var BOX = window.BURGER_BOX;
  var brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

  /* ---------- Limpeza de fotos JPG (fundo branco → transparente) ----------
   * JPG não tem transparência, então uma foto de ingrediente chega com um retângulo branco.
   * Aqui o fundo é removido no navegador (só a parte branca/cinza ligada à borda da foto),
   * a imagem é recortada rente ao ingrediente e a proporção é devolvida para a camada se ajustar.
   * Funciona com o site aberto por servidor (Live Server, http.server, hospedagem). Abrindo o
   * index.html direto do disco (file://) o navegador bloqueia a leitura dos pixels; nesse caso a
   * foto é exibida como está. O ideal continua sendo entregar PNG transparente.
   */
  var cleanCache = {};

  function isSvg(url) { return /\.svg(\?|#|$)/i.test(url || ""); }

  function cleanPhoto(img) {
    var MAX = 1400;
    var s = Math.min(1, MAX / Math.max(img.naturalWidth, img.naturalHeight));
    var w = Math.round(img.naturalWidth * s), h = Math.round(img.naturalHeight * s);
    var canvas = document.createElement("canvas");
    canvas.width = w; canvas.height = h;
    var ctx = canvas.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(img, 0, 0, w, h);
    var imageData = ctx.getImageData(0, 0, w, h); // lança erro se a imagem estiver "bloqueada" (file://)
    var px = imageData.data;
    var T = 232; // acima disso o pixel é considerado branco

    // "fundo" = transparente, branco, cinza sem cor (sombra) ou branco-rosado (sobra de recorte).
    // Só é removido o que estiver ligado à borda da imagem; o miolo do ingrediente é preservado.
    function isBackdrop(p) {
      var i = p * 4, r = px[i], g = px[i + 1], b = px[i + 2];
      if (px[i + 3] < 16) return true;
      var lo = Math.min(r, g, b), hi = Math.max(r, g, b);
      if (lo >= T) return true;
      if (hi - lo < 22 && lo >= 140) return true;
      return lo >= 205 && hi - lo < 45 && (g - b) < 12 && r >= g;
    }

    // Preenchimento a partir das bordas: só remove fundo ligado ao contorno da foto
    var bg = new Uint8Array(w * h);
    var stack = new Int32Array(w * h);
    var sp = 0;
    function push(p) { if (!bg[p] && isBackdrop(p)) { bg[p] = 1; stack[sp++] = p; } }
    var x, y;
    for (x = 0; x < w; x++) { push(x); push((h - 1) * w + x); }
    for (y = 0; y < h; y++) { push(y * w); push(y * w + w - 1); }
    while (sp) {
      var p = stack[--sp];
      var px0 = p % w;
      if (px0 > 0) push(p - 1);
      if (px0 < w - 1) push(p + 1);
      if (p >= w) push(p - w);
      if (p < w * (h - 1)) push(p + w);
    }

    // Suaviza a borda (anti-serrilhado) e tira o halo branco dos pixels de contorno
    var minX = w, minY = h, maxX = -1, maxY = -1;
    for (y = 0; y < h; y++) {
      for (x = 0; x < w; x++) {
        var q = y * w + x, i = q * 4;
        if (bg[q]) { px[i + 3] = 0; continue; }
        var nearBg = (x > 0 && bg[q - 1]) || (x < w - 1 && bg[q + 1]) || (y > 0 && bg[q - w]) || (y < h - 1 && bg[q + w]);
        if (nearBg) {
          var lo = Math.min(px[i], px[i + 1], px[i + 2]);
          var a = Math.max(0, Math.min(1, (255 - lo) / 65));
          if (a < 0.02) { px[i + 3] = 0; continue; }
          for (var c = 0; c < 3; c++) px[i + c] = Math.max(0, Math.min(255, (px[i + c] - 255 * (1 - a)) / a));
          px[i + 3] = Math.min(px[i + 3], Math.round(a * 255));
        }
        if (px[i + 3] > 10) {
          if (x < minX) minX = x; if (x > maxX) maxX = x;
          if (y < minY) minY = y; if (y > maxY) maxY = y;
        }
      }
    }
    if (maxX < 0) return Promise.reject(new Error("imagem sem conteúdo"));

    ctx.putImageData(imageData, 0, 0);
    var cw = maxX - minX + 1, ch = maxY - minY + 1;
    var out = document.createElement("canvas");
    out.width = cw; out.height = ch;
    out.getContext("2d").drawImage(canvas, minX, minY, cw, ch, 0, 0, cw, ch);

    return new Promise(function (resolve, reject) {
      out.toBlob(function (blob) {
        if (!blob) return reject(new Error("falha ao gerar imagem"));
        resolve({ url: URL.createObjectURL(blob), aspect: cw / ch });
      }, "image/png");
    });
  }

  function cleanPhotoCached(img) {
    var key = img.currentSrc || img.src;
    if (!cleanCache[key]) cleanCache[key] = cleanPhoto(img);
    return cleanCache[key];
  }

  /**
   * <img> que tenta o arquivo final (PNG/JPG) e cai no SVG provisório se ele não existir.
   * Com clean = true, fotos JPG têm o fundo removido. img.ready resolve quando a imagem final está pronta.
   */
  function createImage(src, fallback, alt, eager, clean) {
    var img = new Image();
    img.alt = alt || "";
    img.decoding = "async";
    img.loading = eager ? "eager" : "lazy";
    img.draggable = false;

    img.ready = new Promise(function (resolve) {
      function settle() { resolve(img); }
      img.addEventListener("load", function () {
        if (img.dataset.cleaned) return settle();
        if (clean && !isSvg(img.currentSrc || img.src)) {
          cleanPhotoCached(img).then(function (res) {
            img.dataset.cleaned = "1";
            img.dataset.aspect = String(res.aspect);
            img.src = res.url; // dispara "load" de novo → settle()
          }).catch(function (err) {
            console.warn("Não foi possível remover o fundo da foto (" + (img.currentSrc || img.src) + "). " +
              "Abra o site por um servidor (Live Server / http.server) ou use PNG transparente.", err);
            settle();
          });
        } else {
          settle();
        }
      });
      img.addEventListener("error", function () {
        if (!img.dataset.usedFallback && fallback) {
          img.dataset.usedFallback = "1";
          img.src = fallback;
        } else {
          settle();
        }
      });
    });

    img.src = src;
    return img;
  }

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  /* ---------- 1. Camadas do hambúrguer ---------- */
  var burger = document.getElementById("burger");
  var layerEls = [];
  var layerPromises = [];

  window.INGREDIENTS.forEach(function (item, i) {
    var layer = el("div", "layer");
    layer.dataset.layer = item.id;
    layer.style.top = (item.y / BOX.h * 100) + "%";
    layer.style.height = (item.h / BOX.h * 100) + "%";
    layer.style.zIndex = String(20 - i); // camadas de cima ficam à frente nas sobreposições

    var img = createImage(item.image, item.fallback, "", true, true);
    layer.appendChild(img);
    burger.appendChild(layer);
    layerEls.push(layer);

    // Foto recortada: a altura da camada segue a proporção da foto (ver fitLayerToPhoto).
    layerPromises.push(img.ready.then(function () {
      var aspect = parseFloat(img.dataset.aspect);
      if (aspect) { fitLayerToPhoto(item, layer, img, aspect); fittedCount++; }
    }));
  });

  var fittedCount = 0;

  /**
   * Dimensiona a camada pela proporção da foto recortada.
   *   item.width  (0–1, opcional) fração da largura do hambúrguer que a camada ocupa. Padrão 1.
   *   item.squash (0–1, opcional) "achata" a camada na vertical: 0.7 = 30% mais fina (a foto é
   *                               esticada na horizontal, sem diminuir a largura). Use para carnes grossas.
   */
  function fitLayerToPhoto(item, layer, img, aspect) {
    var ratio = item.width || 1;
    var squash = item.squash || 1;
    item._y0 = item.y; item._h0 = item.h;                // valores originais (para o modo manual)
    item._ratio = ratio;
    item.h = BOX.w * ratio / aspect * squash;
    if (squash !== 1) img.style.objectFit = "fill";      // permite achatar sem diminuir a largura
    layer.style.height = (item.h / BOX.h * 100) + "%";
    if (ratio !== 1) {
      layer.style.left = ((1 - ratio) / 2 * 100) + "%";
      layer.style.width = (ratio * 100) + "%";
    }
  }

  /**
   * Com fotos reais as camadas têm alturas diferentes das provisórias. Aqui:
   *   1. empilha as camadas (com leve sobreposição) e centraliza o hambúrguer na caixa;
   *   2. reduz tudo proporcionalmente se o hambúrguer ficar mais alto que a tela comporta;
   *   3. calcula o quanto cada camada sobe/desce, mantendo um vão fixo entre elas
   *      (camadas grossas se afastam mais que as finas, sem se sobrepor).
   * Desligue com window.AUTO_LAYOUT = false (data/ingredients.js) para usar y/h/explode manuais.
   *   item.overlap (opcional) = quanto esta camada entra na de cima, em unidades.
   *   item.gap     (opcional) = vão após separar (padrão 60 no desktop, 24 no celular).
   */
  function autoLayout() {
    var items = window.INGREDIENTS, n = items.length, MAX_STACK = 640;

    function stack() {
      items.forEach(function (it, i) {
        if (i === 0) { it.y = 0; return; }
        var prev = items[i - 1];
        var ov = it.overlap != null ? it.overlap : 0.15 * Math.min(prev.h, it.h);
        it.y = prev.y + prev.h - ov;
      });
      return items[n - 1].y + items[n - 1].h - items[0].y;
    }

    var total = stack();
    if (total > MAX_STACK) {                             // cabe na tela: encolhe tudo por igual
      var k = MAX_STACK / total;
      items.forEach(function (it) { it.h *= k; it._ratio = (it._ratio || 1) * k; });
      total = stack();
    }
    var shift = BOX.h / 2 - (items[0].y + total / 2);
    items.forEach(function (it) { it.y += shift; });

    var pivot = 0;
    items.forEach(function (it, i) { if (it.id === "beef-patty") pivot = i; });
    function explodeSet(gapOf) {
      var ey = [];
      ey[pivot] = items[pivot].y;
      for (var i = pivot - 1; i >= 0; i--) ey[i] = ey[i + 1] - gapOf(items[i]) - items[i].h;
      for (var j = pivot + 1; j < n; j++) ey[j] = ey[j - 1] + items[j - 1].h + gapOf(items[j]);
      return ey.map(function (v, idx) { return v - items[idx].y; });
    }
    var desk = explodeSet(function (it) { return it.gap != null ? it.gap : 60; });
    var mob = explodeSet(function (it) { return it.gap != null ? it.gap * 0.4 : 24; });
    items.forEach(function (it, i) { it.explode = desk[i]; it.explodeMobile = mob[i]; });

    items.forEach(function (it, i) {
      var layer = layerEls[i];
      layer.style.top = (it.y / BOX.h * 100) + "%";
      layer.style.height = (it.h / BOX.h * 100) + "%";
      var r = it._ratio || 1;
      layer.style.left = ((1 - r) / 2 * 100) + "%";
      layer.style.width = (r * 100) + "%";
    });
  }

  /** Modo manual: mantém uma borda da camada parada ao trocar a altura pela da foto. */
  function manualLayout() {
    var items = window.INGREDIENTS, last = items.length - 1;
    items.forEach(function (it, i) {
      if (it._h0 == null) return;
      var anchor = it.anchor || (i === 0 ? "bottom" : i === last ? "top" : "center");
      it.y = anchor === "bottom" ? it._y0 + it._h0 - it.h
           : anchor === "top" ? it._y0
           : it._y0 + it._h0 / 2 - it.h / 2;
      layerEls[i].style.top = (it.y / BOX.h * 100) + "%";
    });
  }

  var imagesReady = Promise.all(layerPromises).then(function () {
    if (!fittedCount) return;                            // só desenhos provisórios: nada a ajustar
    if (window.AUTO_LAYOUT === false) manualLayout(); else autoLayout();
  });


  /* ---------- 2. Legendas ao lado das camadas ---------- */
  var captionsWrap = document.getElementById("captions");
  var captionEls = window.INGREDIENTS.map(function (item, i) {
    var cap = el("article", "caption " + (i % 2 === 0 ? "caption--left" : "caption--right"));
    cap.dataset.caption = item.id;
    cap.appendChild(el("p", "caption__num", "Camada " + item.number));
    cap.appendChild(el("h3", "caption__name", item.name));
    cap.appendChild(el("p", "caption__text", item.short));
    captionsWrap.appendChild(cap);
    return cap;
  });

  /* ---------- 3. Cards de ingredientes ---------- */
  var cardsWrap = document.getElementById("ingredient-cards");
  window.INGREDIENTS.forEach(function (item) {
    var li = el("li", "card");
    li.setAttribute("data-reveal", "");
    li.appendChild(el("span", "card__num", item.number));
    var media = el("div", "card__media");
    media.appendChild(createImage(item.image, item.fallback, "Ilustração: " + item.name, false, true));
    li.appendChild(media);
    li.appendChild(el("p", "card__label", "Camada " + item.number));
    li.appendChild(el("h3", "card__name", item.name));
    li.appendChild(el("p", "card__text", item.long));
    cardsWrap.appendChild(li);
  });

  /* ---------- 4. Cardápio ---------- */
  var menuWrap = document.getElementById("menu-grid");
  window.MENU_ITEMS.forEach(function (item) {
    var li = el("li", "menu-card");
    li.setAttribute("data-reveal", "");

    var media = el("div", "menu-card__media");
    media.appendChild(createImage(item.image, item.fallback, item.name, false));
    li.appendChild(media);

    var body = el("div", "menu-card__body");
    var top = el("div", "menu-card__top");
    top.appendChild(el("h3", "menu-card__name", item.name));
    top.appendChild(el("span", "menu-card__price", brl.format(item.price)));
    body.appendChild(top);
    body.appendChild(el("p", "menu-card__desc", item.description));

    var btn = el("button", "btn btn--ghost", "Conhecer hambúrguer");
    btn.type = "button";
    btn.dataset.menuId = item.id;
    btn.setAttribute("aria-label", "Conhecer hambúrguer " + item.name);
    body.appendChild(btn);

    li.appendChild(body);
    menuWrap.appendChild(li);
  });

  window.BurgerRender = {
    createImage: createImage,
    brl: brl,
    layers: layerEls,
    captions: captionEls,
    imagesReady: imagesReady
  };
})();