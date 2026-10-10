/**
 * DADOS DOS INGREDIENTES (as 9 camadas do hambúrguer, de cima para baixo)
 *
 * Como ajustar a animação (tudo aqui, sem mexer no código):
 *   explode  → distância (em unidades) que a camada sobe (-) ou desce (+) ao se separar.
 *              O hambúrguer é desenhado numa caixa de 600 x 680 unidades.
 *   delay    → atraso (0 a 0.6) do início do movimento da camada: maior = sai mais tarde.
 *   y / h    → posição e altura da camada no hambúrguer MONTADO (mesmas unidades).
 *
 * Imagens: coloque os PNGs com fundo transparente em assets/images/burger/.
 * Enquanto o PNG não existir, o site usa o SVG provisório de mesmo nome (fallback).
 * Recomendado: PNGs com proporção 600 : h  (ex.: bun-top = 600 x 190 px, ou 2x/3x disso).
 */
window.BURGER_BOX = { w: 600, h: 680 };

window.BURGER_BOX = { w: 600, h: 680 };

window.INGREDIENTS = [
  {
    id: "bun-top", number: "01", name: "Pão Brioche",
    short: "Dourado por fora, macio por dentro.",
    long: "Brioche assado todos os dias, com gergelim tostado e manteiga na medida.",
    image: "assets/images/burger/pao.jpg",
    fallback: "assets/images/burger/bun-top.svg",
    y: 40,  h: 190, explode: -30, delay: 0.0
  },
  {
    id: "special-sauce", number: "02", name: "Molho da Casa",
    short: "Uma receita exclusiva que define nosso sabor.",
    long: "Defumado, levemente picante e cremoso. Receita guardada a sete chaves.",
    image: "assets/images/burger/molho da casa.jpg",
    fallback: "assets/images/burger/molho da casa.jpg",
    y: 235, h: 44,  explode: -45, delay: 0.05
  },
  {
    id: "lettuce", number: "03", name: "Alface Americana",
    short: "Frescor e crocância em cada mordida.",
    long: "Folhas selecionadas, lavadas e geladas minutos antes de irem para a chapa.",
    image: "assets/images/burger/alface.jpg",
    fallback: "assets/images/burger/alface.jpg",
    y: 268, h: 66,  explode: -30, delay: 0.1
  },
  {
    id: "tomato", number: "04", name: "Tomate Fresco",
    short: "Selecionado diariamente.",
    long: "Maduro no ponto certo, em fatias grossas que trazem suculência e acidez.",
    image: "assets/images/burger/c.jpg",
    fallback: "assets/images/burger/c.jpg",
    y: 326, h: 52,  explode: -18, delay: 0.15
  },
  {
    id: "cheddar", number: "05", name: "Cheddar",
    short: "Cremoso, intenso e derretido.",
    long: "Cheddar curado que derrete devagar sobre a carne, em camadas generosas.",
    image: "assets/images/burger/molho02.jpg",
    fallback: "assets/images/burger/molho02.jpg",
    y: 372, h: 56,  explode: -8,  delay: 0.2
  },
  {
    id: "beef-patty", number: "06", name: "Carne Bovina",
    short: "Blend bovino grelhado para preservar o sabor.",
    long: "180 g de blend de cortes nobres, moído na hora e selado na brasa.",
    image: "assets/images/burger/hambuger.jpg",
    fallback: "assets/images/burger/hambuger.jpg",
    y: 400, h: 70,  explode: 0,   delay: 0.25
  },
  {
    id: "bacon", number: "07", name: "Bacon Crocante",
    short: "Crocante e cheio de personalidade.",
    long: "Curado e defumado em casa, assado até ficar dourado e estalando.",
    image: "assets/images/burger/bacon.jpg",
    fallback: "assets/images/burger/bacon.jpg",
    y: 462, h: 54,  explode: 8,   delay: 0.3
  },
  {
    id: "caramelized-onion", number: "08", name: "Cebola Caramelizada",
    short: "Caramelizada lentamente.",
    long: "Quarenta minutos em fogo baixo até virar um doce profundo e macio.",
    image: "assets/images/burger/cebollaa.jpg",
    fallback: "assets/images/burger/cebollaa.jpg",
    y: 508, h: 50,  explode: 18,  delay: 0.35
  },
  {
    id: "bun-bottom", number: "09", name: "Pão Inferior",
    short: "A base perfeita para todos os ingredientes.",
    long: "Mais firme, tostado na chapa para segurar tudo sem perder a maciez.",
    image: "assets/images/burger/paobaixo.jpg",
    fallback: "assets/images/burger/paobaixo.jpg",
    y: 552, h: 90,  explode: 15,  delay: 0.4
  }
];