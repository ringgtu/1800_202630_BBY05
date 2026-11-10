class SiteNavbar extends HTMLElement {
  connectedCallback() {
    this.innerHTML = `
      <div class="pb-5 mb-5" aria-hidden="true"></div>

      <nav class="navbar fixed-bottom bg-secondary-subtle"
           aria-label="Main navigation">
        <div class="container-fluid">
          <ul class="navbar-nav flex-row w-100 text-center">

            <li class="nav-item flex-fill">
              <a class="nav-link text-dark" href="./profile.html">
                <i class="bi bi-person-fill fs-1 d-block"
                   aria-hidden="true"></i>
                <span>Profile</span>
              </a>
            </li>

            <li class="nav-item flex-fill">
              <a class="nav-link text-dark" href="./library.html">
                <i class="bi bi-book-half fs-1 d-block"
                   aria-hidden="true"></i>
                <span>My Library</span>
              </a>
            </li>

            <li class="nav-item flex-fill">
              <a class="nav-link text-dark" href="./search.html">
                <i class="bi bi-search fs-1 d-block"
                   aria-hidden="true"></i>
                <span>Search</span>
              </a>
            </li>

          </ul>
        </div>
      </nav>
    `;
  }
}

customElements.define("site-navbar", SiteNavbar);
