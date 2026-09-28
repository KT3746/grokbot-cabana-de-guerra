/**
 * Trava #app no visualViewport (não no 100vh/100dvh).
 *
 * No celular (principalmente 390×844), a barra de endereço e o
 * visualViewport.offsetTop/scale fazem o que você VÊ e o que o
 * navegador considera clicável saírem do lugar. Overlay em
 * position:absolute dentro de 100dvh + camada de toque em
 * position:fixed era a combinação que desalinhava "Jogar de novo".
 *
 * Tudo (canvas, overlay, HUD, joystick) fica position:absolute
 * dentro de #app, que aqui ganha o tamanho e a origem exatos
 * da área visível. Assim o retângulo pintado == o alvo do toque.
 */
export function bindViewport(app, onChange) {
  if (!app) return () => {};

  const apply = () => {
    try { window.scrollTo(0, 0); } catch (_) { /* ok */ }

    const vv = window.visualViewport;
    const w = Math.max(1, Math.round(vv && vv.width ? vv.width : window.innerWidth));
    const h = Math.max(1, Math.round(vv && vv.height ? vv.height : window.innerHeight));
    const left = vv ? Math.round(vv.offsetLeft || 0) : 0;
    const top = vv ? Math.round(vv.offsetTop || 0) : 0;

    const html = document.documentElement;
    const body = document.body;
    html.style.width = `${w}px`;
    html.style.height = `${h}px`;
    body.style.width = `${w}px`;
    body.style.height = `${h}px`;

    /* absolute (não fixed): fixed + visualViewport é o bug clássico de hit-test no iOS */
    app.style.position = "absolute";
    app.style.left = `${left}px`;
    app.style.top = `${top}px`;
    app.style.width = `${w}px`;
    app.style.height = `${h}px`;
    app.style.right = "auto";
    app.style.bottom = "auto";
    app.style.transform = "none";
    app.style.zoom = "normal";

    if (typeof onChange === "function") onChange(w, h);
  };

  window.addEventListener("resize", apply);
  window.addEventListener("orientationchange", () => {
    apply();
    /* iOS demora a estabilizar visualViewport após girar */
    setTimeout(apply, 120);
    setTimeout(apply, 320);
  });
  if (window.visualViewport) {
    window.visualViewport.addEventListener("resize", apply);
    window.visualViewport.addEventListener("scroll", apply);
  }
  apply();
  return apply;
}
