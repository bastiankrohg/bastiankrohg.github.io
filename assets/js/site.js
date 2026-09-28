// Survey panel: a drone flies a lawnmower (boustrophedon) coverage pattern over
// a suspected hazardous area and flags anomalies as its sensor swath passes them.
// Without JS, or with reduced motion, the finished survey is shown as static SVG.
(function () {
  var panel = document.querySelector("[data-survey]");
  if (!panel) return;

  var trail = panel.querySelector(".s-trail");
  var swath = panel.querySelector(".s-swath");
  var drone = panel.querySelector(".s-drone");
  var flags = Array.prototype.slice.call(panel.querySelectorAll(".s-flag"));
  var status = panel.querySelector(".survey__status");
  var replay = panel.querySelector(".survey__replay");
  var lanes = Number(panel.getAttribute("data-lanes")) || 1;

  var total = trail.getTotalLength();
  var DURATION = 15000;
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)");

  // Where along the path does the drone pass each flag?
  var SAMPLES = 600;
  flags.forEach(function (flag) {
    var fx = Number(flag.getAttribute("data-x"));
    var fy = Number(flag.getAttribute("data-y"));
    var best = Infinity, at = 0;
    for (var i = 0; i <= SAMPLES; i++) {
      var p = trail.getPointAtLength((i / SAMPLES) * total);
      var d = (p.x - fx) * (p.x - fx) + (p.y - fy) * (p.y - fy);
      if (d < best) { best = d; at = i / SAMPLES; }
    }
    flag._at = at;
  });

  function pad(n) { return (n < 10 ? "0" : "") + n; }

  function render(t) {
    var len = t * total;
    var offset = total - len;
    trail.style.strokeDasharray = total;
    trail.style.strokeDashoffset = offset;
    swath.style.strokeDasharray = total;
    swath.style.strokeDashoffset = offset;

    var p = trail.getPointAtLength(len);
    drone.setAttribute("transform", "translate(" + p.x.toFixed(1) + " " + p.y.toFixed(1) + ")");

    var found = 0;
    flags.forEach(function (flag) {
      var seen = t >= flag._at;
      if (seen) found++;
      if (seen && flag.classList.contains("is-hidden")) flag.classList.add("is-new");
      flag.classList.toggle("is-hidden", !seen);
    });

    var lane = Math.min(lanes, Math.floor(t * lanes) + 1);
    status.textContent = t >= 1
      ? "Survey complete · " + found + " indicators for follow-up"
      : "Lane " + pad(lane) + "/" + pad(lanes) + " · Progress " + pad(Math.round(t * 100)) + "% · Flags " + found;
  }

  var raf = null;
  function run() {
    if (raf) cancelAnimationFrame(raf);
    replay.hidden = true;
    flags.forEach(function (f) { f.classList.remove("is-new"); });
    var start = null;
    function frame(now) {
      if (start === null) start = now;
      var t = Math.min(1, (now - start) / DURATION);
      render(t);
      if (t < 1) raf = requestAnimationFrame(frame);
      else { raf = null; replay.hidden = false; }
    }
    raf = requestAnimationFrame(frame);
  }

  replay.addEventListener("click", run);

  if (reduce.matches) {
    render(1);
    replay.hidden = true;
  } else {
    render(0);
    run();
  }
})();

// Current year in footers
(function () {
  var els = document.querySelectorAll("[data-year]");
  for (var i = 0; i < els.length; i++) els[i].textContent = new Date().getFullYear();
})();
