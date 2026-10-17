class SiteNavbar extends HTMLElement {
    connectedCallback() {
        this.innerHTML = `
            <style>
                site-navbar {
                    display: block;
                }

                site-navbar .app-navbar {
                    position: fixed;
                    bottom: 0;
                    left: 0;
                    right: 0;
                    z-index: 1030;
                    display: flex;
                    background: #d9d9d9;
                    padding: 10px 0;
                    padding-bottom:
                        calc(10px + env(safe-area-inset-bottom));
                }

                site-navbar a {
                    flex: 1;
                    min-width: 0;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    color: black;
                    text-decoration: none;
                    font-family: Arial, sans-serif;
                    font-size: 18px;
                    line-height: 1.2;
                }

                site-navbar i {
                    font-size: 42px;
                    line-height: 1;
                    margin-bottom: 5px;
                }

                site-navbar a:focus-visible {
                    outline: 3px solid black;
                    outline-offset: -3px;
                }

                site-navbar .navbar-space {
                    height:
                        calc(100px + env(safe-area-inset-bottom));
                }
            </style>

            <div class="navbar-space" aria-hidden="true"></div>

            <nav class="app-navbar" aria-label="Main navigation">
                <a href="./profile.html">
                    <i class="bi bi-person-fill"
                       aria-hidden="true"></i>
                    <span>profile</span>
                </a>

                <a href="./main.html">
                    <i class="bi bi-book-half"
                       aria-hidden="true"></i>
                    <span>My Library</span>
                </a>

                <a href="./search.html">
                    <i class="bi bi-search"
                       aria-hidden="true"></i>
                    <span>search</span>
                </a>
            </nav>
        `;
    }
}

customElements.define("site-navbar", SiteNavbar);