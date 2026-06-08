////////////////////////////////////////////////////////
// API
////////////////////////////////////////////////////////
const API = "http://localhost:8080/api/v1";

////////////////////////////////////////////////////////
// AUTH HELPERS
////////////////////////////////////////////////////////
function getUser() {
    const user = localStorage.getItem("user");
    return user ? JSON.parse(user) : null;
}
function isAdmin() {
    return localStorage.getItem("isAdmin") === "true";
}


////////////////////////////////////////////////////////
// BASE64 IMAGE DECODER
////////////////////////////////////////////////////////
function decodeBase64(str) {
    try {
        return atob(str);
    } catch {
        return str;
    }
}

////////////////////////////////////////////////////////
// LOGIN NAVIGATION
////////////////////////////////////////////////////////
document.addEventListener("click", (e) => {
    if (e.target.id === "btn-login") {
        showPage("login");
        setTimeout(() => {
            const btn = document.getElementById("loginBtn");
            if (btn) btn.onclick = login;
        }, 0);
    }
});

////////////////////////////////////////////////////////
// LOGIN
////////////////////////////////////////////////////////
async function login() {

    console.log("LOGIN() STARTED");

    const username = document.getElementById("username")?.value;
    const password = document.getElementById("password")?.value;

    console.log("LOGIN REQUEST:", { username, password });

    if (!username || !password) {
        document.getElementById("error").textContent =
            "Fyll i användarnamn och lösenord";
        return;
    }

    const data = await apiPost(`${API}/auth/login`, { username, password });

    if (!data || data.error) {
        document.getElementById("error").textContent =
            "Fel användarnamn eller lösenord";
        return;
    }

    const token = btoa(username + ":" + password);
    localStorage.setItem("token", token);

    const user = {
        id: data.userId,
        username: data.username
    };

    localStorage.setItem("user", JSON.stringify(user));
    localStorage.setItem("isAdmin", data.isAdmin ? "true" : "false");

     
    if (isAdmin()) {
        showPage("users");
    } else {
        showPage("userdashboard");
    }
    // Uppdatera navbaren efter m'kay
    updateNavbar();
}
///////////////////////////
// LÄGG IN BAKGRUNDSBILD FÖR ALLA ADMINDELARNA
//////////////////////////

////////////////////////////////////////////////////////
//  POST FÖR LOGIN REQUEST EN HELT ÖPPEN POST FÖR VEM SOM HELST SKA JU KUNNA LOGGA IN
////////////////////////////////////////////////////////
async function apiPost(url, body) {
    console.log("=== FETCH START ===");
    console.log("URL:", url);
    console.log("BODY SENT:", body);

    try {
        const res = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body)
        });

        console.log("RAW RESPONSE OBJECT:", res);

        let data;
        try {
            data = await res.json();
        } catch (jsonErr) {
            console.error("JSON PARSE ERROR:", jsonErr);
            data = null;
        }

        console.log("JSON RESPONSE:", data);
        console.log("=== FETCH END ===");

        return data;

    } catch (err) {
        console.error("FETCH ERROR:", err);
        return { error: true };
    }
}


////////////////////////////////////////////////////////
// AUTH FETCH FÖR ATT INTE GÖRA FETCH KOD PÅ ALLA REQUESTS = BRA SKIT = LÄGGER IN IF SATSER LITE EFTERSOM
////////////////////////////////////////////////////////
async function authFetch(url, options = {}) {
    const token = localStorage.getItem("token");

    // Bygg headers korrekt
    const headers = {
        ...(options.headers || {})
    };

    if (token) {
        headers["Authorization"] = "Basic " + token;
    }

    // Sätt Content-Type om det inte är FormData
    if (!(options.body instanceof FormData)) {
        headers["Content-Type"] = "application/json";
    }

    try {
        const res = await fetch(url, {
            ...options,
            headers
        });

        // 401 = unauthorized
        if (res.status === 401) {
            logout();
            return { ok: false, status: 401, data: "Unauthorized" };
        }

        const text = await res.text();
        let data = null;

        if (text) {
            try {
                data = JSON.parse(text);
            } catch {
                data = text;
            }
        }

        return {
            ok: res.ok,
            status: res.status,
            data
        };

    } catch (err) {
        console.error("FETCH ERROR:", err);
        return {
            ok: false,
            status: 0,
            data: "Network error"
        };
    }
}


////////////////////////////////////////////////////////
// GENERIC API REQUEST FÖR JSON OCH FORMDATA FÖR ALLA CRUD OPERATIONER = ENDPOINT + GET VILKEN METOD + DATA PÅ NULL SOM UTGÅNGSVÄRDE 
////////////////////////////////////////////////////////
async function apiRequest(endpoint, method = "GET", data = null) {
    try {
        const options = { method };

        if (data instanceof FormData) {
            options.body = data;
        } else if (data) {
            options.body = JSON.stringify(data);
        }

        const result = await authFetch(`${API}${endpoint}`, options);

        if (!result || !result.ok) {
    console.error("SERVER ERROR:", result);

    const message =
        result.data && typeof result.data === "string"
            ? result.data
            : result.data
            ? JSON.stringify(result.data, null, 2)
            : `Status: ${result.status}`;

    showPopup("error", "Kunde inte skapa bokning", message);

    return null;
}


        return result.data;

    } catch (err) {
        console.error(err);

        //  Nätverksfel
        showPopup("error", "Nätverksfel", "Kunde inte kontakta servern.");

        return null;
    }
}


////////////////////////////////////////////////////////
// LANDING PAGE
////////////////////////////////////////////////////////
////////////////////////////////////////////////////////
// LANDING PAGE
////////////////////////////////////////////////////////

let mode;

async function loadLanding() {

    mode = "landing";   // ← sätts här

    const cars = await getCars();
    if (!cars) return;

    const container = document.getElementById("landing-cars");
    if (!container) return;

    renderCarCards(cars, { 
        container: "landing-cars", 
        mode: "landing" 
    });
}


////////////////////////
// LÄGGER IN HÄMTA BILDER PÅ RÄTT SÄTT HÄR TILL USER
////////////////////////
function getCarImageSrc(car) {
    if (!car || !car.image) {
        return "https://via.placeholder.com/400x250?text=Ingen+bild";
    }

    // Nya bilar – rå Base64-BLOB
    if (car.image.length > 200) {
        return `data:image/jpeg;base64,${car.image}`;
    }

    // Gamla bilar – Base64-kodade filnamn
    try {
        const decoded = atob(car.image);
        return `images/${decoded}`;
    } catch (e) {
        console.warn("Kunde inte decoda gammal bild:", car.image, e);
        return "https://via.placeholder.com/400x250?text=Ingen+bild";
    }
}

////////////////////////////////////////////////////////
// USER DASHBOARD VISA EGNA BOKNINGAR VISA BILLISTA MED ONCLICK ELLER KNAPP FÖR BOKNING
////////////////////////////////////////////////////////

async function loadUserDashboard() {

    const cars = await getCars();
    const carsMap = new Map(cars.map(c => [c.id, c]));

    const user = getUser();
    if (!user) return;

    const bookings = (JSON.parse(localStorage.getItem("myBookings")) || [])
        .filter(b => b.userId === user.id);

    const carsContainer = document.getElementById("user-cars");
    const bookingsContainer = document.getElementById("user-bookings");

    //
    // VISA BILAR
    //
    if (carsContainer) {

        // Rendera bilar
        renderCarCards(cars, { container: "user-cars", mode: "user" });

        // SORTERING FÖR USER-BILAR = bara namn och typ
        enableCardSorting(
            cars,
            "user-car-sort-dropdown",
            sortedList => {
            renderCarCards(sortedList, { container: "user-cars", mode: "user" });
            }
        );
    }

    //
    // VISA USERNS BOKNINGAR
    //
    if (bookingsContainer) {

        if (bookings.length === 0) {
            bookingsContainer.innerHTML = `<p class="ll-body">Inga bokningar ännu.</p>`;
            return;
        }

        bookingsContainer.innerHTML = bookings.map(b => {

            const car = carsMap.get(b.carId);
            const imgSrc = getCarImageSrc(car);
            const carName = car ? `${car.name} ${car.model}` : "Error bil";

            return `
           <div class="ll-panel--positive">

           <img src="${imgSrc}" class="ll-booking-img" alt="${carName}">

          <div class="ll-booking-row"><strong>Bil:</strong> ${carName}</div>
          <div class="ll-booking-row"><strong>Från:</strong> ${b.fromDate}</div>
           <div class="ll-booking-row"><strong>Till:</strong> ${b.toDate}</div>

           </div>
            `;
        }).join("");
    }
}


//////////////////////////////////////////////
//SÅ ENKLA CRUD OPERATIONER SOM MÖJLIGT FÖR ANVÄNDARE??
///////////////////////////////////////////////
async function createUser(data) {
  return apiRequest("/users", "POST", data);
}

async function getUsers() {
  return apiRequest("/users", "GET");
}


async function updateUser(id, data) {
  return apiRequest(`/users/${id}`, "PUT", data);
}

async function deleteUser(id) {
  return apiRequest(`/users/${id}`, "DELETE");
}

//////////////////////////////////////////////
/*============================================
  //BYGGER OM FÖRDELNING AV ANSVAR SÅ DET INTE SUGER
=============================================*/
// Ladda de hämtade användarna och rendera UI
async function loadUsers(){
  const users = await getUsers();
  if (!users) return;

  renderUserUI(users);
}

//Rendera user UI tar över ansvaret för UI
function renderUserUI(users) {
  const topbar = document.getElementById("users-topbar");
  const list = document.getElementById("users-list");

  // Bygg topbar bara en gång
  if (topbar.children.length === 0) {
    topbar.appendChild(buildUserSortDropdown());
    topbar.appendChild(buildUserAddButton());
  }

  // Rendera cards
  renderUserCards(users);
  enableUserCardSorting(users);
}

/////////////////////////////////////////
// dropdown menyns funktion extraherad från loadUsers
////////////////////////////////////////
function buildUserSortDropdown() {
  const dropdown = document.createElement("div");
  dropdown.id = "user-sort-dropdown";
  dropdown.classList.add("ll-sort-dropdown");

  dropdown.innerHTML = `
    <div class="ll-sort-trigger">Sortera efter ▾</div>
    <div class="ll-sort-menu">
      <button data-sort="id">ID <span class="arrow">↑</span></button>
      <button data-sort="firstName">Förnamn <span class="arrow">↑</span></button>
      <button data-sort="lastName">Efternamn <span class="arrow">↑</span></button>
      <button data-sort="username">Användarnamn <span class="arrow">↑</span></button>
      <button data-sort="email">Email <span class="arrow">↑</span></button>
      <button data-sort="phone">Telefon <span class="arrow">↑</span></button>
      <button data-sort="noOfOrders">Antal orders <span class="arrow">↑</span></button>
      <button data-sort="role">Roll <span class="arrow">↑</span></button>
    </div>
  `;

  return dropdown;
}
//////////////////////////////////////////
// User add button extraherad från loadUsers
/////////////////////////////////////////
function buildUserAddButton() {
  const addBtn = document.createElement("button");
  addBtn.id = "user-add-btn";
  addBtn.classList.add("ll-btn-add");
  addBtn.textContent = "+ Ny användare";

  addBtn.addEventListener("click", () => {
    openGenericModal(
      "Skapa ny användare",
      {
        Förnamn: "",
        Efternamn: "",
        Användarnamn: "",
        Telefon: "",
        Email: "",
        Roll: "",
        Password: ""
      },
      async newUser => {
        const result = await createUser({
          firstName: newUser.Förnamn,
          lastName: newUser.Efternamn,
          username: newUser.Användarnamn,
          phone: newUser.Telefon,
          email: newUser.Email,
          role: newUser.Roll,
          password: newUser.Password
        });

        if (!result) return;

        closeGenericModal();
        loadUsers();
      },
      () => closeGenericModal()
    );
  });

  return addBtn;
}
///////////////////////////////////
// --- Ritar cards under dropdownen --- Fungerar som innan --- ändrar så alla använder ll-panel ll.card och ll-card-row
///////////////////////////////////
function renderUserCards(users) {
  const list = document.getElementById("users-list");
  list.innerHTML = "";

  users.forEach(u => {
    const panel = document.createElement("div");
    panel.classList.add("ll-panel");

    const card = document.createElement("div");
    card.classList.add("ll-card");

    card.innerHTML = `
      <div class="ll-card-header ll-h3">${u.firstName} ${u.lastName}</div>

      <div class="ll-card-row"><strong>ID:</strong> ${u.id}</div>
      <div class="ll-card-row"><strong>Förnamn:</strong> ${u.firstName}</div>
      <div class="ll-card-row"><strong>Efternamn:</strong> ${u.lastName}</div>
      <div class="ll-card-row"><strong>Användarnamn:</strong> ${u.username}</div>
      <div class="ll-card-row"><strong>Telefon:</strong> ${u.phone}</div>
      <div class="ll-card-row"><strong>Email:</strong> ${u.email}</div>
      <div class="ll-card-row"><strong>Antal orders:</strong> ${u.noOfOrders}</div>
      <div class="ll-card-row"><strong>Roll:</strong> ${u.role}</div>
    `;

    // Klick på kortet öppnar modal
    card.addEventListener("click", () => {
      openGenericModal(
        `${u.firstName} ${u.lastName}`,
        {
          ID: u.id,
          Förnamn: u.firstName,
          Efternamn: u.lastName,
          Användarnamn: u.username,
          Email: u.email,
          Telefon: u.phone,
          Roll: u.role
        },
        async updated => {

          // Check på obligatoriska fält
          if (!updated.Förnamn || !updated.Efternamn || !updated.Användarnamn ||
              !updated.Email || !updated.Telefon) {
            showPopup("error", "Fel", "Alla fält måste fyllas i.");
            return;
          }

          await updateUser(u.id, {
            firstName: updated.Förnamn,
            lastName: updated.Efternamn,
            username: updated.Användarnamn,
            email: updated.Email,
            phone: updated.Telefon,
            role: updated.Roll
          });

          closeGenericModal();
          loadUsers();
        },
        async () => {
          if (!confirm("Ta bort användaren?")) return;

          await deleteUser(u.id);
          closeGenericModal();
          loadUsers();
        }
      );
    });

    panel.appendChild(card);
    list.appendChild(panel);
  });
}


//////////////////////////////////////////
// Cards sorting för users pilbytarfunktionen generaliserad
/////////////////////////////////////////
function enableUserCardSorting(users) {
  enableCardSorting(users, "user-sort-dropdown", renderUserCards);
}


/////////////////////////////////////////////
// BILARNAS CRUD
////////////////////////////////////////////
async function getCars() {
  return apiRequest("/cars", "GET");
}

async function createCar(data) {
  return apiRequest("/cars", "POST", data);
}

async function deleteCar(id) {
  return apiRequest(`/cars/${id}`, "DELETE");
}

////////////////////////////////////////
// UPDATE BEHÖVER INTE FORMDATA OCH LAGD BILD LIGGER
////////////////////////////////////////
async function updateCar(id, updatedCar) {
  return apiRequest(`/cars/${id}`, "PUT", {
    id,
    name: updatedCar.Namn,
    model: updatedCar.Modell,
    feature1: updatedCar.Feature1,
    feature2: updatedCar.Feature2,
    feature3: updatedCar.Feature3,
    type: updatedCar.Typ,
    price: Number(updatedCar.Pris),
    booked: updatedCar.Bokad
  });
}

////////////////////////////////////////
//LOAD CARS OCH RENDERA UI
///////////////////////////////////////
async function loadCars() {
  const cars = await getCars();
  if (!cars) return;

  renderCarUI(cars);
}

// RENDERA CARS UI 
function renderCarUI(cars) {
  const topbar = document.getElementById("cars-topbar");
  const list = document.getElementById("cars-list");

  if (topbar.children.length === 0) {
    topbar.appendChild(buildCarSortDropdown());
    topbar.appendChild(buildCarAddButton());
  }
  // Lägger in så rätt container och mode används även här m'kay
  renderCarCards(cars, { container: "cars-list", mode: "admin" });
  enableCarCardSorting(cars);
}

//////////////////////////////////////////
// Car sort dropdown 
//////////////////////////////////////////
function buildCarSortDropdown() {
  const dropdown = document.createElement("div");
  dropdown.id = "car-sort-dropdown";
  dropdown.classList.add("ll-sort-dropdown");

  dropdown.innerHTML = `
    <div class="ll-sort-trigger">Sortera efter ▾</div>
    <div class="ll-sort-menu">
      <button data-sort="id">ID <span class="arrow">↑</span></button>
      <button data-sort="name">Namn <span class="arrow">↑</span></button>
      <button data-sort="model">Modell <span class="arrow">↑</span></button>
      <button data-sort="type">Typ <span class="arrow">↑</span></button>
      <button data-sort="price">Pris <span class="arrow">↑</span></button>
      <button data-sort="booked">Bokad <span class="arrow">↑</span></button>
    </div>
  `;

  return dropdown;
}
//////////////////////////////////////////
// Car add button (motsvarar buildUserAddButton)
//////////////////////////////////////////
function buildCarAddButton() {
  const addBtn = document.createElement("button");
  addBtn.id = "car-add-btn";
  addBtn.classList.add("ll-btn-add");
  addBtn.textContent = "+ Ny bil";

  addBtn.addEventListener("click", () => {
    openGenericModal(
      "Lägg till bil",
      {
        Namn: "",
        Modell: "",
        Feature1: "",
        Feature2: "",
        Feature3: "",
        Typ: "",
        Pris: "",
        Bokad: false,
        Bildlänk: null
      },

      async newCar => {
        /////////////////////////////////////////
        // 1. Validering av obligatoriska fält
        /////////////////////////////////////////
        const required = ["Namn", "Modell", "Typ", "Pris"];
        let hasError = false;

        required.forEach(field => {
          const value = newCar[field];

          // FIX: endast strängar trimmas
          const isEmpty =
            value === null ||
            value === undefined ||
            (typeof value === "string" && value.trim() === "");

          if (isEmpty) hasError = true;
        });

        if (hasError) {
          showPopup("error", "Fel", "Alla obligatoriska fält måste fyllas i.");
          return;
        }

        /////////////////////////////////////////
        // Bygg FormData (backend kräver detta)
        /////////////////////////////////////////
        const formData = new FormData();

        formData.append("name", newCar.Namn.trim());
        formData.append("model", newCar.Modell.trim());
        formData.append("feature1", newCar.Feature1 || "");
        formData.append("feature2", newCar.Feature2 || "");
        formData.append("feature3", newCar.Feature3 || "");
        formData.append("type", newCar.Typ.trim());
        formData.append("price", Number(newCar.Pris));

        //  Korrekt boolean-hantering
        formData.append("booked", newCar.Bokad === true || newCar.Bokad === "true");

        /////////////////////////////////////////
        // Bild (MultipartFile)
        /////////////////////////////////////////
        //  endast om fil finns
        if (newCar.Bildlänk instanceof File) {
        formData.append("image", newCar.Bildlänk);
         }

        /////////////////////////////////////////
        // Skicka POST med FormData
        /////////////////////////////////////////
        const result = await createCar(formData);
          // ingen Content-Type
      
        if (!result) return;

        closeGenericModal();
        loadCars();
      },

      () => closeGenericModal()
    );
  });

  return addBtn;
}

///////////////////////////////////
//  Ritar CAR cards IHOPSATT HOME USERDASHBOARD OCH ADMIN MED OLIKE MODES
// Det här blir den CENTRALISERADE RENDERINGEN FÖR ALLA CARDS NU
///////////////////////////////////
 function renderCarCards(cars, { container, mode }) {
    console.log("renderCarCards CALLED", { count: cars?.length, container, mode });

    const list = document.getElementById(container);
    console.log("list element:", list);
    if (!list) return;
    
    list.innerHTML = "";

    cars.forEach(c => {

let imgSrc = "";

// Nya bilar – rå Base64-BLOB (långa strängar) blir lätt vansinnig
if (c.image && c.image.length > 200) {
    imgSrc = `data:image/jpeg;base64,${c.image}`;
}

// Gamla bilar – Base64-kodade filnamn
else if (c.image) {
    try {
        const decoded = atob(c.image);   // t.ex. "corvette.jpg"
        imgSrc = `images/${decoded}`;
    } catch (e) {
        console.warn("Kunde inte decoda gammal bild:", c.image, e);
        imgSrc = "https://via.placeholder.com/400x250?text=Ingen+bild";
    }
}

// Fallback
else {
    imgSrc = "https://via.placeholder.com/400x250?text=Ingen+bild";
}

        const panel = document.createElement("div");
        panel.classList.add("ll-panel");

        const card = document.createElement("div");
        card.classList.add("ll-card");
      // Gör om InnerHTML så bara admin ser ID och BOKAD
        card.innerHTML = `
    <div class="ll-card-header ll-h3">${c.name} ${c.model}</div>

    <img 
        src="${imgSrc}" 
        alt="Ingen bild" 
        class="car-image"
    >

    ${mode === "admin" ? `
    <div class="ll-card-row"><strong>ID:</strong> ${c.id}</div>
    <div class="ll-card-row"><strong>Namn:</strong> ${c.name}</div>
    <div class="ll-card-row"><strong>Modell:</strong> ${c.model}</div>
    <div class="ll-card-row"><strong>Typ:</strong> ${c.type}</div>

    ${c.feature1 ? `<div class="ll-card-row"><strong>Feature 1:</strong> ${c.feature1}</div>` : ""}
    ${c.feature2 ? `<div class="ll-card-row"><strong>Feature 2:</strong> ${c.feature2}</div>` : ""}
    ${c.feature3 ? `<div class="ll-card-row"><strong>Feature 3:</strong> ${c.feature3}</div>` : ""}
    ` : `
    <div class="ll-card-row">${c.type}</div>

    <ul class="ll-card-features">
        ${c.feature1 ? `<li>${c.feature1}</li>` : ""}
        ${c.feature2 ? `<li>${c.feature2}</li>` : ""}
        ${c.feature3 ? `<li>${c.feature3}</li>` : ""}
    </ul>
    `}

    <div class="ll-card-row price-row">
    Endast <span class="price-green">${c.price} kr</span>
    </div>


${mode === "admin" ? `
    <div class="ll-card-row"><strong>Bokad:</strong> ${c.booked ? "Ja" : "Nej"}</div>
` : ""}
`;

    

        //
        // Klick-logik
        //
    card.addEventListener("click", () => {

    // Hämta user först
    const user = getUser();

    // Oinloggad - rerouta till login direkt
    if (!user) {
        window.location.hash = "#login";
        return;
    }

    // Mode är globalt – använd direkt
    const currentMode = mode || "landing";

    //
    // LANDING MODE
    //
    if (currentMode === "landing") {

        // ADMIN
        if (isAdmin()) {
            openGenericModal(
                `${c.name} ${c.model}`,
                {
                    ID: c.id,
                    Namn: c.name,
                    Modell: c.model,
                    Feature1: c.feature1,
                    Feature2: c.feature2,
                    Feature3: c.feature3,
                    Typ: c.type,
                    Pris: c.price,
                    Bokad: c.booked,
                },
                async updated => {
                    await updateCar(c.id, updated);
                    closeGenericModal();
                    loadCars();
                },
                async () => {
                    if (!confirm("Ta bort bilen?")) return;
                    await deleteCar(c.id);
                    closeGenericModal();
                    loadCars();
                }
            );
            return;
        }

        // USER
        openBookingModal(c);
        return;
    }

    //
    // USER MODE
    //
    if (currentMode === "user") {
        openBookingModal(c);
        return;
    }

    //
    // ADMIN MODE
    //
    if (currentMode === "admin" && isAdmin()) {
        openGenericModal(
            `${c.name} ${c.model}`,
            {
                ID: c.id,
                Namn: c.name,
                Modell: c.model,
                Feature1: c.feature1,
                Feature2: c.feature2,
                Feature3: c.feature3,
                Typ: c.type,
                Pris: c.price,
                Bokad: c.booked,
            },
            async updated => {
                await updateCar(c.id, updated);
                closeGenericModal();
                loadCars();
            },
            async () => {
                if (!confirm("Ta bort bilen?")) return;
                await deleteCar(c.id);
                closeGenericModal();
                loadCars();
            }
        );
        return;
        }
      });



        panel.appendChild(card);
        list.appendChild(panel);
        });
        }
///////////////////////////////////
// Open BookingModal
///////////////////////////////////
function openBookingModal(car) {
    openGenericModal(
        `Boka ${car.name} ${car.model}`,
        {
            fromDate: "",
            toDate: ""
        },
        async updated => {
            await confirmBooking(car.id, updated.fromDate, updated.toDate);
        },
        () => {
            closeGenericModal();
        }
    );
    // Ändra till boka istället för Spara och dölj delete
    document.getElementById("modal-save").textContent = "Boka";
    document.getElementById("modal-delete").classList.add("hidden");
    }

//////////////////////////////////////////
// CONFIRM BOKNING
//////////////////////////////////////////
//////////////////////////////////////////
async function confirmBooking(carId, fromDate, toDate) {
    console.log("CONFIRM BOOKING DEBUG:", { carId, fromDate, toDate });

    //  Datumkontroll
    if (!fromDate || !toDate) {
        showPopup("error", "Fel", "Välj datum innan du bokar.");
        return;
    }

    //  Användarkontroll
    const user = getUser();
    if (!user) {
        showPopup("error", "Fel", "Ingen användare inloggad.");
        return;
    }

    //  Backend vill ha carId, startDate, endDate
    const body = {
        carId: carId,
        startDate: fromDate,
        endDate: toDate
    };

    console.log("SENDING BOOKING TO BACKEND:", body);

    // Skicka bokningen
    const result = await apiRequest("/bookings", "POST", body);

    console.log("SERVER RESPONSE:", result);

    //  SUCCESS = resultat null busigt
    if (result === null) {

        // Skapa lokal bokning som matchar backend
        const newBooking = {
            id: Date.now(),        // fake ID tills backend ger riktiga
            carId: carId,
            fromDate: fromDate,
            toDate: toDate,
            userId: user.id,
            active: true           // active får inte vara undefined utan true för 
                                  // att autouppdatering ska fungera
        };

        // Spara i localStorage
        const myBookings = JSON.parse(localStorage.getItem("myBookings")) || [];
        myBookings.push(newBooking);
        localStorage.setItem("myBookings", JSON.stringify(myBookings));

        // Visa popup
        showPopup("success", "Bokad!", "Din bokning är klar.");

        // Stäng modal
        closeGenericModal();

        // Ladda om dashboard
        loadUserDashboard();
        return;
    }

    //ERROR någonstans
    showPopup("error", "Fel", "Kunde inte skapa bokning.");
}


//////////////////////////////////
//
function enableCarCardSorting(cars) {
  enableCardSorting(cars, "car-sort-dropdown", renderCarCards);
}
//////////////////////////////////////////
//////////////////////////////////////////
// BOOKINGS CRUD SÅ ENKLA SOM MÖJLIGT
/////////////////////////////////////////
/////////////////////////////////////////
async function getBookings() {
  return apiRequest("/bookings", "GET");
}

async function createBooking(data) {
  return apiRequest("/bookings", "POST", data);
}

async function updateBooking(id, data) {
  return apiRequest(`/bookings/${id}`, "PUT", data);
}

async function deleteBooking(id) {
  return apiRequest(`/bookings/${id}`, "DELETE");
}

////////////////////////////////////////
// LOAD BOOKINGS OCH RENDERA UI
////////////////////////////////////////

async function loadBookings() {
  const bookings = await getBookings();

  // AUTO-RETURN NÄR ADMIN LADDAR BOOKINGS DEL AV PROJEKT MULTIBOKNING
  await autoUpdateBookingActiveStatus(bookings);

  renderBookingUI(bookings);

    // AUTO-REFRESH en gång i minuten DEL AV PROJEKT MULTIBOKNING
  if (!window.bookingAutoRefresh) {
    window.bookingAutoRefresh = setInterval(async () => {
      const updated = await getBookings();
      await autoUpdateBookingActiveStatus(updated);
      renderBookingUI(updated);
    }, 60000);
  }
}

// RENDERA UI 
function renderBookingUI(bookings) {
  const topbar = document.getElementById("bookings-topbar");
  const list = document.getElementById("bookings-list");

  //Topbar byggs bara om den inte finns
  if (topbar.children.length === 0) {
    topbar.appendChild(buildBookingSortDropdown()); 
  }

  renderBookingCards(bookings);
  enableBookingCardSorting(bookings);
}
////////////////////////////////////////
// AUTOUPDATE PÅ BOKNINGAR BEROENDE PÅ DATUM SÅ NÄR ADMIN LADDAR BOKNINGARNA SÅ UPPDATERAS DE DEL AV PROJEKT MULTIBOKNING
// KÖR DEN BARA I BOOKINGS FÅR DUGA
// MÅSTE JU KOLLA SÅ DET ÄR ADMIN SOM ÄR INLOGGAD OCKSÅ HAHA VOI VOI
////////////////////////////////////////
async function autoUpdateBookingActiveStatus(bookings) {
  // Kör bara auto-update om vi ÄR på bokningssidan
if (!location.pathname.includes("bookings")) return;

  const user = JSON.parse(localStorage.getItem("user"));
  if (!user || user.role !== "Admin") return;

  const today = new Date();
  const cars = await apiRequest("/cars", "GET");
  const carsMap = Object.fromEntries(cars.map(c => [c.id, c]));


  //Loopa datum
  for (const b of bookings) {
    const start = new Date(b.fromDate);
    const end = new Date(b.toDate);
    // CAR = CARSMAP
     const car = carsMap[b.carId];
    if (!car) continue

    ///////////////////////////
    // STARTA BOKNING FÖR DEN HAR TROLIGEN BLIVIT AVSTÄNGD AV JUST DEN HÄR COOLA FUNKTIONEN
    ///////////////////////////
    if (!b.active && start <= today && today <= end) {

      // Uppdatera bokningen
      await updateBooking(b.id, { active: true });

      // Uppdatera bilen med alla fält och små bokstäver på features tack
      await updateCar(b.carId, {
       Namn: car.name,
       Modell: car.model,
        Feature1: car.feature1,
        Feature2: car.feature2,
        Feature3: car.feature3,
        Typ: car.type,
        Pris: car.price,
        Bokad: true
        });
      }

    ////////////////////////////////
    // AVSLUTA BOKNING FÖR DEN ÄR EGENTLIGEN INTE AKTIV JUST NU
    ////////////////////////////////
    if (b.active && end < today) {

      // Uppdatera bokningen
      await updateBooking(b.id, { active: false });

      // Uppdatera bilen med alla fält
      await updateCar(b.carId, {
       Namn: car.name,
        Modell: car.model,
        Feature1: car.feature1,
       Feature2: car.feature2,
         Feature3: car.feature3,
        Typ: car.type,
        Pris: car.price,
          Bokad: false
        });

      }
    }
    }
    ///////////////////////////////
// KOLLA OM DATUM ÖVERLAPPAR DEL AV PROJEKT MULTIBOKNING
//////////////////////////////
function datesOverlap(aStart, aEnd, bStart, bEnd) {
  return !(aEnd < bStart || aStart > bEnd);
}
///////////////////////////////
// VALIDERA BOKNINGSDATUM DEL AV PROJEKT MULTIBOKNING
///////////////////////////////
async function validateBooking(carId, fromDate, toDate) {
  const bookings = await getBookings();

  const newStart = new Date(fromDate);
  const newEnd = new Date(toDate);

  for (const b of bookings) {
    if (b.carId !== carId) continue;

    const existingStart = new Date(b.fromDate);
    const existingEnd = new Date(b.toDate);

    if (datesOverlap(newStart, newEnd, existingStart, existingEnd)) {
      return false;
    }
  }

  return true;
}
////////////////////////////////////////
// BOOKING SORT DROPDOWN
////////////////////////////////////////

function buildBookingAddButton() {
  const addBtn = document.createElement("button");
  addBtn.id = "booking-add-btn";
  addBtn.classList.add("ll-btn-add");
  addBtn.textContent = "+ Ny bokning";

  addBtn.addEventListener("click", () => {
    openGenericModal(
      "Lägg till bokning",
      {
        Från: "",
        Till: "",
        CarID: "",
        Aktiv: true
      },
      async newBooking => {
        // VERIFIERA SÅ DATUMEN INTE ÖVERLAPPAR FÖRST
        const ok = await validateBooking(
          newBooking.CarID,
          newBooking.Från,
          newBooking.Till
        );

        if (!ok) {
          showPopup("error", "Ogiltig bokning", "Bilen är redan bokad under den perioden.");
          return;
        }

        // SKAPA BOKNING MED CREATE
        const result = await createBooking({
          fromDate: newBooking.Från,
          toDate: newBooking.Till,
          carId: newBooking.CarID,
          active: newBooking.Aktiv
        });

        if (!result) return;

        closeGenericModal();
        loadBookings();
      },
      () => closeGenericModal()
    );
  });

  return addBtn;
}

////////////////////////////
//  RENDERA BOOKING CARDS 
////////////////////////////
function renderBookingCards(bookings) {
  const list = document.getElementById("bookings-list");
  list.innerHTML = "";

  bookings.forEach(b => {
    const panel = document.createElement("div");
    panel.classList.add("ll-panel");

    const card = document.createElement("div");
    card.classList.add("ll-card");

    // data för sortering
    card.dataset.id = b.id;
    card.dataset.from = b.fromDate;
    card.dataset.to = b.toDate;
    card.dataset.carid = b.carId;
    card.dataset.active = b.active;

    card.innerHTML = `
      <div class="ll-card-header ll-h3">Bokning #${b.id}</div>

      <div class="ll-card-row"><strong>ID:</strong> ${b.id}</div>
      <div class="ll-card-row"><strong>Från:</strong> ${b.fromDate}</div>
      <div class="ll-card-row"><strong>Till:</strong> ${b.toDate}</div>
      <div class="ll-card-row"><strong>Car ID:</strong> ${b.carId}</div>
      <div class="ll-card-row"><strong>Aktiv:</strong> ${b.active ? "Ja" : "Nej"}</div>
    `;

    // Klick på kortet öppnar modal
    card.addEventListener("click", () => {
      openGenericModal(
        `Bokning #${b.id}`,
        {
          ID: b.id,
          Från: b.fromDate,
          Till: b.toDate,
          CarID: b.carId,
          Aktiv: b.active
        },
        async updated => {
          await updateBooking(b.id, {
            fromDate: updated.Från,
            toDate: updated.Till,
            carId: updated.CarID,
            active: updated.Aktiv
          });

          closeGenericModal();
          loadBookings();
        },
        async () => {
          if (!confirm("Ta bort bokningen?")) return;

          await deleteBooking(b.id);
          closeGenericModal();
          loadBookings();
                  }
      );
    });

    panel.appendChild(card);
    list.appendChild(panel);
  });
}
//  SORTERING DROPDOWN FÖR BOKNINGAR
function enableBookingCardSorting(bookings) {
  enableCardSorting(bookings, "booking-sort-dropdown", renderBookingCards);
}

//////////////////////////////////////////////
//Ladda UserModal GENERIC BIG GUY
//////////////////////////////////////////////
  function openGenericModal(title, fields, onSave, onDelete) {
  document.getElementById("modal-title").textContent = title;

  const container = document.getElementById("modal-fields");
  container.innerHTML = "";

  Object.entries(fields).forEach(([key, value]) => {
  const label = document.createElement("label");
  label.textContent = key;

  let input;

  // Roll som dropdown 
  if (key === "Roll") {
    input = document.createElement("select");
    input.dataset.field = key;

    const optUser = document.createElement("option");
    optUser.value = "ROLE_USER";
    optUser.textContent = "Användare";

    const optAdmin = document.createElement("option");
    optAdmin.value = "admin";
    optAdmin.textContent = "Admin";

    input.appendChild(optUser);
    input.appendChild(optAdmin);

    input.value = value || "ROLE_USER";
  }

  //  Boolean dropdown ja eller nej på bokningar
  else if (key === "Aktiv" || key === "Bokad") {
    input = document.createElement("select");
    input.dataset.field = key;

    const optTrue = document.createElement("option");
    optTrue.value = "true";
    optTrue.textContent = "Ja";

    const optFalse = document.createElement("option");
    optFalse.value = "false";
    optFalse.textContent = "Nej";

    input.appendChild(optTrue);
    input.appendChild(optFalse);

    input.value = value ? "true" : "false";
  }
  // Datumfält på almanackan
  else if (key === "fromDate" || key === "toDate") {
    input = document.createElement("input");
    input.type = "date";
    input.dataset.field = key;
    input.value = value || "";
    }
    // Admins datumfält (svenska)
    else if (key === "Från" || key === "Till") {
    input = document.createElement("input");
    input.type = "date";
    input.dataset.field = key;
    input.value = value || "";
}


  //////////////////////////////////
  // Gör en bildlänk för filuppladdning
  /////////////////////////////////
  else if (key === "Bildlänk") {
      input = document.createElement("input");
      input.type = "file";
      input.accept = "image/*";
      input.dataset.field = key;

      input.addEventListener("change", e => {
        fields[key] = e.target.files[0]; // sparar filen
      });

      container.appendChild(label);
      container.appendChild(input);
      return; // hoppa över standard-input
    }
  // Vanlig input
  else {
    input = document.createElement("input");
    input.value = value;
    input.dataset.field = key;

    if (key === "Password") {
      input.type = "password";
    }
  }

  container.appendChild(label);
  container.appendChild(input);
});
/////////////////////////////////
// SAVE KNAPPEN ARNE
/////////////////////////////////

 document.getElementById("modal-save").onclick = () => {
  const updated = {};

  container.querySelectorAll("[data-field]").forEach(input => {
    const field = input.dataset.field;

    // Filuppladdning
    if (input.type === "file") {
      updated[field] = input.files[0] || null;
    }

    // Boolean dropdown
    else if (field === "Bokad" || field === "Aktiv") {
      updated[field] = input.value === "true";
    }

    // Pris
    else if (field === "Pris") {
      updated[field] = Number(input.value);
    }

    // Standard textfält
    else {
      updated[field] = input.value;
    }
  });

  onSave(updated);
};

  // DELETE
  document.getElementById("modal-delete").onclick = () => onDelete();

  // CANCEL 
  document.getElementById("modal-cancel").onclick = (e) => {
  e.stopPropagation();
  closeGenericModal();
  };

  // Visa modal
  document.getElementById("generic-modal").classList.remove("hidden");
}

// Stäng modal
function closeGenericModal() {
  const modal = document.getElementById("generic-modal");
  if (!modal) return;
  modal.classList.add("hidden");
}

// ALLMÄN POPUPFUNKTION FÖR POSITIVA OCH NEGATIVA OCH ALLMÄNA MEDDELANDEN
function showPopup(type, title, message) {
  const popup = document.getElementById("ll-global-popup");
  const titleEl = document.getElementById("ll-global-popup-title");
  const textEl = document.getElementById("ll-global-popup-text");

  popup.classList.remove("ll-popup--success", "ll-popup--error");

  if (type === "success") popup.classList.add("ll-popup--success");
  if (type === "error") popup.classList.add("ll-popup--error");

  titleEl.textContent = title;
  textEl.textContent = message;

  popup.classList.remove("hidden");
  popup.classList.add("visible");

  
  setTimeout(() => {
    popup.classList.remove("visible");
    setTimeout(() => popup.classList.add("hidden"), 250);
  }, 4000);
}

// Close-knappen
document.addEventListener("click", e => {
  if (e.target.classList.contains("ll-popup-close")) {
    const popup = document.getElementById("ll-global-popup");
    popup.classList.remove("visible");
    setTimeout(() => popup.classList.add("hidden"), 250);
  }
});
////////////////////////////
// KORTSORTERINGS FUNKTION FÖR DROPDOWN
////////////////////////////
function enableCardSorting(list, dropdownId, renderFn) {
  const dropdown = document.getElementById(dropdownId);
  if (!dropdown) return;

  let sortState = {
    field: null,
    direction: "asc"
  };

  dropdown.querySelectorAll("button").forEach(btn => {
    btn.addEventListener("click", () => {
      const field = btn.dataset.sort;

      // Samma fält → byt riktning
      if (sortState.field === field) {
        sortState.direction = sortState.direction === "asc" ? "desc" : "asc";
      } else {
        sortState.field = field;
        sortState.direction = "asc";
      }

      // Sortera listan
      list.sort((a, b) => {
        let x = a[field];
        let y = b[field];

        x = x?.toString().toLowerCase() || "";
        y = y?.toString().toLowerCase() || "";

        // Nummer
        if (!isNaN(x) && !isNaN(y) && x !== "" && y !== "") {
          return sortState.direction === "asc" ? x - y : y - x;
        }

        // Text
        return sortState.direction === "asc"
          ? x.localeCompare(y)
          : y.localeCompare(x);
      });

      // Uppdatera pilarna
      updateSortArrowsGeneric(dropdownId, sortState);

      // Rendera om
      renderFn(list);
    });
    });
    }
    /////////////////////////////
    // BOKNINGSSORTERINGS DROPDOWN
    /////////////////////////////
    function buildBookingSortDropdown() {
  const dropdown = document.createElement("div");
  dropdown.id = "booking-sort-dropdown";
  dropdown.classList.add("ll-sort-dropdown");

  dropdown.innerHTML = `
    <div class="ll-sort-trigger">Sortera efter ▾</div>
    <div class="ll-sort-menu">
      <button data-sort="id">ID <span class="arrow">↑</span></button>
      <button data-sort="fromDate">Från datum <span class="arrow">↑</span></button>
      <button data-sort="toDate">Till datum <span class="arrow">↑</span></button>
      <button data-sort="carId">Car ID <span class="arrow">↑</span></button>
      <button data-sort="active">Aktiv <span class="arrow">↑</span></button>
    </div>
  `;

  return dropdown;
  }

  ////////////////////////////////////
  //UPPDATERA PILARNA I SORTERINGEN ANVÄND SEN TILL USERBILSORTERING OCKSÅ
  ////////////////////////////////////
  function updateSortArrowsGeneric(dropdownId, sortState) {
  const dropdown = document.getElementById(dropdownId);

  dropdown.querySelectorAll("button").forEach(btn => {
    const arrow = btn.querySelector(".arrow");
    const field = btn.dataset.sort;

    if (field === sortState.field) {
      arrow.textContent = sortState.direction === "asc" ? "↑" : "↓";
    } else {
      arrow.textContent = "↑";
    }
  });
}
/////////////////////////////////
// USERDASHBOARD SORTERINGSFUNKTION
/////////////////////////////////
function buildUserCarSortDropdown() {
  const dropdown = document.createElement("div");
  dropdown.id = "user-car-sort-dropdown";
  dropdown.classList.add("ll-sort-dropdown");

  dropdown.innerHTML = `
    <div class="ll-sort-trigger">Sortera bilar ▾</div>
    <div class="ll-sort-menu">
      <button data-sort="name">Namn <span class="arrow">↑</span></button>
      <button data-sort="type">Typ <span class="arrow">↑</span></button>
    </div>
  `;

  return dropdown;
}

/////////////////////////////////
// USERBOOKINGS VISNING OCH RENDERA BOKNINGARNA
/////////////////////////////////
function toggleUserBookings() {
    const box = document.getElementById("user-bookings-container");
    const btn = document.querySelector("button[onclick='toggleUserBookings()']");

    const isHidden = box.style.display === "none";

    // Visa / dölj
    box.style.display = isHidden ? "block" : "none";

    // Byt knapptext
    btn.textContent = isHidden
        ? "Dölj mina bokningar"
        : "Visa mina bokningar";
}

function renderUserBookings(bookings) {
    const container = document.getElementById("user-bookings");
    container.innerHTML = "";

    if (!bookings || bookings.length === 0) {
        container.innerHTML = "<p class='ll-body'>Inga bokningar ännu.</p>";
        return;
    }

    bookings.forEach(b => {
        const car = carsMap.get(b.carId);
        const imgSrc = car ? getCarImageSrc(car) : "img/default-car.png";

        const div = document.createElement("div");
        div.className = "ll-panel--positive";

        div.innerHTML = `
            <img src="${imgSrc}" class="ll-booking-img" alt="Bilbild">

            <div class="ll-booking-row"><strong>Från:</strong> ${b.fromDate}</div>
            <div class="ll-booking-row"><strong>Till:</strong> ${b.toDate}</div>
        `;

        container.appendChild(div);
    });
}
//////////////////////////////////////////
// LOGIN KNAPP PÅ LANDING och en window listener som ersätter hash
/////////////////////////////////////////
document.addEventListener("click", (e) => {
  if (e.target.id === "btn-login-landing") {
    location.hash = "login";
  }
});
window.addEventListener("hashchange", () => {
    const page = location.hash.replace("#", "") || "home";
    showPage(page);
});











