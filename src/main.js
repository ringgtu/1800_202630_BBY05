import "bootstrap/dist/css/bootstrap.min.css";
import "bootstrap";
import "bootstrap-icons/font/bootstrap-icons.css";
import "./components/site-navbar.js";

if (!["/", "/index.html"].includes(window.location.pathname)) {
  import("./authentication.js").then(({ requireAuth }) => requireAuth());
}
