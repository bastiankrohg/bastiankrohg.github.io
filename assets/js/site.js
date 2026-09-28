// Current year in footers
(function () {
  var els = document.querySelectorAll("[data-year]");
  for (var i = 0; i < els.length; i++) els[i].textContent = new Date().getFullYear();
})();
