// Kopiering lyssnare för färgkoder och datatargets(copy-btn)
document.addEventListener("click", function (e) {

  // 1. Kopiera färgkod (data-color)
  if (e.target.hasAttribute("data-color")) {
    const color = e.target.getAttribute("data-color");

    navigator.clipboard.writeText(color).then(() => {
      e.target.textContent = "Copied!";
      setTimeout(() => {
        e.target.textContent = "Copy";
      }, 2000);
    });

    return;
  }

  // 2. Kopiera DOM-element (data-target)
  if (e.target.classList.contains("copy-btn")) {
    const target = e.target.getAttribute("data-target");
    if (!target) return;

    const el = document.querySelector(target);
    if (!el) return;

    navigator.clipboard.writeText(el.textContent).then(() => {
      e.target.textContent = "Copied!";
      setTimeout(() => {
        e.target.textContent = "Copy";
      }, 2000);
    });

    return;
  }
});

////////////////////////////////////////////////////////
// AUTH HELPERS
////////////////////////////////////////////////////////
function getUser() {
    try {
        return JSON.parse(localStorage.getItem("user"));
    } catch {
        return null;
    }
}

function isLoggedIn() {
    return !!getUser();
}

function isAdmin() {
    return localStorage.getItem("isAdmin") === "true";
}


////////////////////////////////////////////////////////
// NAVBAR VISIBILITY
////////////////////////////////////////////////////////
function updateNavbar() {
  const user = getUser();
  const isLoggedIn = !!user;
  const isAdmin = localStorage.getItem("isAdmin") === "true";


  // Visa/dölj login/logout
  document.getElementById("nav-login")?.classList.toggle("hidden", isLoggedIn);
  document.getElementById("nav-logout")?.classList.toggle("hidden", !isLoggedIn);

  // Visa adminlänkar om admin
  document.querySelectorAll(".admin-only").forEach(el => {
    el.classList.toggle("hidden", !isAdmin);
  });
  // Visa Mina sidor för inloggad User så den navigera tillbaka
   document.getElementById("nav-userdashboard")?.classList.toggle(
    "hidden",
    !isLoggedIn || isAdmin
  );
}


////////////////////////////////////////////////////////
// SPA NAVIGATION
////////////////////////////////////////////////////////
document.addEventListener("click", (e) => {
    const link = e.target.closest("[data-page]");
    if (!link) return;

    e.preventDefault();

    const page = link.getAttribute("data-page");
    if (!page) return;

    showPage(page);
});


////////////////////////////////////////////////////////
// PAGE LOADER
////////////////////////////////////////////////////////
function showPage(page) {
    const content = document.getElementById("content");

    // Blockera admin-sidor för vanliga användare
    if (!isAdmin() && (page === "users" || page === "cars" || page === "bookings")) {
        page = "home";
    }

    // Sätt mode baserat på vilken sida som visas
    if (page === "home") mode = "landing";
    if (page === "userdashboard") mode = "user";
    if (page === "users" || page === "cars" || page === "bookings") mode = "admin";

    const template = document.getElementById(page);

    if (template && content) {
        content.innerHTML = template.innerHTML;
    }

    if (page === "home" && typeof loadLanding === "function") loadLanding();
    if (page === "login") {
        const btn = document.getElementById("loginBtn");
        if (btn) btn.onclick = login;
    }
    if (page === "userdashboard" && typeof loadUserDashboard === "function") loadUserDashboard();
    if (page === "users" && typeof loadUsers === "function") loadUsers();
    if (page === "cars" && typeof loadCars === "function") loadCars();
    if (page === "bookings" && typeof loadBookings === "function") loadBookings();

    location.hash = page;
}


////////////////////////////////////////////////////////
// MOBILE NAV TOGGLE
////////////////////////////////////////////////////////
document.addEventListener("DOMContentLoaded", () => {
  const toggle = document.querySelector('.ll-nav-toggle');
  const nav = document.querySelector('.ll-nav');

  if (toggle && nav) {
    toggle.addEventListener('click', () => {
      nav.classList.toggle('open');
    });
  
    // Stäng nav vid val i menyn
    nav.querySelectorAll("a, button, .ll-nav-item").forEach(item => {
      item.addEventListener("click", () => {
        nav.classList.remove("open");
      });
    });
  }
});

// Stäng nav om man klickar utanför
document.addEventListener("click", (e) => {
  const nav = document.querySelector(".ll-nav");
  const toggle = document.querySelector(".ll-nav-toggle");

  if (!nav || !toggle) return;

  if (!nav.contains(e.target) && !toggle.contains(e.target)) {
    nav.classList.remove("open");
  }
});

//////////////////////////////////
// Kopplar in logout här
//////////////////////////////////
const logoutBtn = document.getElementById("nav-logout");
if (logoutBtn) {
  logoutBtn.addEventListener("click", (e) => {
    e.preventDefault();
    logout();
  });
}


////////////////////////////////////////////////////////
// INITIAL LOAD OCH UPDATE NAVBAR 
////////////////////////////////////////////////////////
window.addEventListener("load", () => {
    updateNavbar();
    const page = location.hash.replace("#", "") || "home";
    showPage(page);
});

///////////////
// LOGGOUT
///////////////
function logout() {
    localStorage.removeItem("user");
    localStorage.removeItem("token");
    localStorage.removeItem("isAdmin");
    updateNavbar();
    showPage("home");
}



