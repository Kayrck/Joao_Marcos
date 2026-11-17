/* Define o tema antes da primeira pintura (evita "flash"). Arquivo externo por causa da CSP (script-src 'self').
   Ordem: preferência salva > preferência do aparelho (escuro) > claro. */
(function () {
  var theme = "light";
  try {
    var saved = localStorage.getItem("jm-theme");
    if (saved === "light" || saved === "dark") theme = saved;
    else if (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches) theme = "dark";
  } catch (e) {}
  var root = document.documentElement;
  if (theme === "dark") root.classList.add("dark");
  root.style.colorScheme = theme;
})();
