if ("serviceWorker" in navigator) {
  navigator.serviceWorker
    .register("/sw.js")
    .then(function () {
      console.log("Service Worker Registered");
    })
    .catch(function (err) {
      console.log("Error al registrar el Service Worker:", err);
    });
}

// INSTALACIÓN DE LA APP (PWA)
var deferredPrompt = null;
var installButtons = document.querySelectorAll(".install-app");

function setInstallButtons(visible) {
  for (var i = 0; i < installButtons.length; i++) {
    installButtons[i].style.display = visible ? "inline-block" : "none";
  }
}

window.addEventListener("beforeinstallprompt", function (event) {
  // Evita el mini-aviso automático y guarda el evento para usarlo con el botón.
  event.preventDefault();
  deferredPrompt = event;
  setInstallButtons(true);
});

for (var i = 0; i < installButtons.length; i++) {
  installButtons[i].addEventListener("click", function () {
    if (!deferredPrompt) {
      return;
    }

    deferredPrompt.prompt();

    deferredPrompt.userChoice.then(function (choice) {
      console.log("Instalación:", choice.outcome);
      deferredPrompt = null;
      setInstallButtons(false);
    });
  });
}

window.addEventListener("appinstalled", function () {
  console.log("App instalada");
  deferredPrompt = null;
  setInstallButtons(false);
});
