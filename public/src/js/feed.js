var shareImageButton = document.querySelector("#share-image-button");
var createPostArea = document.querySelector("#create-post");
var closeCreatePostModalButton = document.querySelector(
  "#close-create-post-modal-btn",
);
var sharedMomentsArea = document.querySelector("#shared-moments");
var form = document.querySelector("form");
var titleInput = document.querySelector("#title");
var locationInput = document.querySelector("#location");

function openCreatePostModal() {
  createPostArea.style.display = "block";

  requestAnimationFrame(function () {
    createPostArea.style.transform = "translateY(0)";
  });
}
function closeCreatePostModal() {
  //createPostArea.style.display = 'none';
  createPostArea.style.transform = "translateY(100vh)";
}

shareImageButton.addEventListener("click", openCreatePostModal);
closeCreatePostModalButton.addEventListener("click", closeCreatePostModal);

function clearCards() {
  while (sharedMomentsArea.hasChildNodes()) {
    sharedMomentsArea.removeChild(sharedMomentsArea.lastChild);
  }
}

function createCard(data) {
  var cardWrapper = document.createElement("div");
  cardWrapper.className = "shared-moment-card mdl-card mdl-shadow--2dp";

  var cardTitle = document.createElement("div");
  cardTitle.className = "mdl-card__title";
  cardTitle.style.backgroundImage = "url(" + data.image + ")";
  cardTitle.style.backgroundSize = "cover";
  cardTitle.style.height = "180px";
  cardWrapper.appendChild(cardTitle);

  var cardTitleTextElement = document.createElement("h2");
  cardTitleTextElement.style.color = "white";
  cardTitleTextElement.className = "mdl-card__title-text";
  cardTitleTextElement.textContent = data.title;
  cardTitle.appendChild(cardTitleTextElement);

  var cardSupportingText = document.createElement("div");
  cardSupportingText.className = "mdl-card__supporting-text";
  cardSupportingText.textContent = data.location;
  cardSupportingText.style.textAlign = "center";
  cardWrapper.appendChild(cardSupportingText);

  componentHandler.upgradeElement(cardWrapper);
  sharedMomentsArea.appendChild(cardWrapper);
}

function updateUI(data) {
  clearCards();

  for (var i = 0; i < data.length; i++) {
    createCard(data[i]);
  }
}

// Imagen que se usa en los posts nuevos. Cambia esta ruta por la tuya.
var POST_IMAGE = "/src/images/mi-imagen.png";

var url = "https://uteq-test-e1406-default-rtdb.firebaseio.com/post.json";
var networkDataReceived = false;

function loadFromNetwork() {
  return fetch(url)
    .then(function (res) {
      if (!res.ok) {
        throw new Error("Error al consultar publicaciones: " + res.status);
      }

      return res.json();
    })
    .then(function (data) {
      networkDataReceived = true;
      console.log("From web", data);

      var dataArray = [];

      for (var key in data) {
        dataArray.push(data[key]);
      }

      updateUI(dataArray);
    })
    .catch(function (err) {
      console.log("Sin acceso a la red. Se usarán los datos locales.", err);
    });
}

loadFromNetwork();

// Cuando el service worker termina de sincronizar, refrescar el feed.
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.addEventListener("message", function (event) {
    if (event.data && event.data.type === "posts-synced") {
      loadFromNetwork();
    }
  });
}

if ("indexedDB" in window) {
  readAllData("posts")
    .then(function (data) {
      if (!networkDataReceived) {
        console.log("From cache", data);
        updateUI(data);
      }
    })
    .catch(function (err) {
      console.log("Error al leer los datos locales:", err);
    });
}

function sendData() {
  fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      id: new Date().toISOString(),
      title: titleInput.value,
      location: locationInput.value,
      image: POST_IMAGE,
    }),
  }).then(function (res) {
    console.log("Sent data", res);
    loadFromNetwork();
  });
}

form.addEventListener("submit", function (event) {
  event.preventDefault();

  if (titleInput.value.trim() === "" || locationInput.value.trim() === "") {
    alert("Please enter valid data!");
    return;
  }

  closeCreatePostModal();

  if ("serviceWorker" in navigator && "SyncManager" in window) {
    navigator.serviceWorker.ready
      .then(function (sw) {
        var post = {
          id: new Date().toISOString(),
          title: titleInput.value,
          location: locationInput.value,
          image: POST_IMAGE,
        };

        return writeData("sync-posts", post)
          .then(function () {
            return sw.sync.register("sync-new-posts");
          })
          .then(function () {
            var snackbarContainer = document.querySelector(
              "#confirmation-toast",
            );
            var data = {
              message: "Your Post was saved for syncing!",
            };

            snackbarContainer.MaterialSnackbar.showSnackbar(data);
          });
      })
      .catch(function (err) {
        console.log(err);
      });
  } else {
    sendData();
  }
});
