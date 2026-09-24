function esc(s) {
  return String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
}

function fillTemplate(key, vars = {}) {
  let s = t(key);
  Object.entries(vars).forEach(([k, v]) => {
    s = s.split(`{${k}}`).join(v == null ? "" : String(v));
  });
  return s;
}
