importScripts("/src/js/idb.js");
importScripts("/src/js/utility.js");

var CACHE_STATIC_NAME = "static-v17";
var CACHE_DYNAMIC_NAME = "dynamic-v13";

var STATIC_FILES = [
  "/",
  "/index.html",
  "/offline.html",
  "/help/",
  "/src/js/app.js",
  "/src/js/feed.js",
  "/src/js/idb.js",
  "/src/js/utility.js",
  "/src/js/material.min.js",
  "/src/css/app.css",
  "/src/css/feed.css",
  "/src/css/help.css",
  "/src/images/main-image-lg.png",
  "https://fonts.googleapis.com/css?family=Roboto:400,700",
  "https://fonts.googleapis.com/icon?family=Material+Icons",
  "https://cdnjs.cloudflare.com/ajax/libs/material-design-lite/1.3.0/material.indigo-pink.min.css",
];

// INSTALACIÓN
self.addEventListener("install", function (event) {
  console.log("[Service Worker] Instalando...");

  event.waitUntil(
    caches
      .open(CACHE_STATIC_NAME)
      .then(function (cache) {
        console.log("[Service Worker] Guardando archivos estáticos");
        return cache.addAll(STATIC_FILES);
      })
      .then(function () {
        return self.skipWaiting();
      }),
  );
});

// ACTIVACIÓN
self.addEventListener("activate", function (event) {
  console.log("[Service Worker] Activando...");

  event.waitUntil(
    caches
      .keys()
      .then(function (keys) {
        return Promise.all(
          keys.map(function (key) {
            var isAppCache =
              key.indexOf("static-v") === 0 || key.indexOf("dynamic-v") === 0;

            if (
              isAppCache &&
              key !== CACHE_STATIC_NAME &&
              key !== CACHE_DYNAMIC_NAME
            ) {
              return caches.delete(key);
            }
          }),
        );
      })
      .then(function () {
        return self.clients.claim();
      }),
  );
});

// COMPROBAR SI UN RECURSO ES ESTÁTICO
function isInArray(string, array) {
  var cachePath;

  if (string.indexOf(self.location.origin) === 0) {
    cachePath = string.substring(self.location.origin.length);
  } else {
    cachePath = string;
  }

  return array.indexOf(cachePath) > -1;
}

// CONSULTAR LA RED Y GUARDAR UN RECURSO EN CACHÉ DINÁMICA
function fetchAndCache(request) {
  return fetch(request).then(function (res) {
    // Permitir imágenes externas con respuesta opaque.
    if (!res.ok && res.type !== "opaque") {
      return res;
    }

    var clonedRes = res.clone();

    return caches
      .open(CACHE_DYNAMIC_NAME)
      .then(function (cache) {
        return cache.put(request, clonedRes);
      })
      .catch(function (err) {
        console.log("[Service Worker] Error al guardar el recurso:", err);
      })
      .then(function () {
        return res;
      });
  });
}

// INTERCEPTAR SOLICITUDES
self.addEventListener("fetch", function (event) {
  if (event.request.method !== "GET" || !event.request.url.startsWith("http")) {
    return;
  }

  var url = "https://uteq-test-e1406-default-rtdb.firebaseio.com/post.json";

  if (event.request.url.split("?")[0] === url) {
    // FIREBASE: obtener datos de la red.
    var networkResponse = fetch(event.request);

    // Mantener activo el service worker hasta guardar los datos.
    event.waitUntil(
      networkResponse
        .then(function (res) {
          if (!res.ok) {
            throw new Error("Firebase respondió con estado " + res.status);
          }

          return res.clone().json();
        })
        .then(function (data) {
          var posts = [];

          if (data) {
            for (var key in data) {
              var post = data[key];

              if (post && typeof post === "object") {
                if (post.id === undefined || post.id === null) {
                  post.id = key;
                }

                posts.push(post);
              }
            }
          }

          return clearAllData("posts")
            .then(function () {
              return Promise.all(
                posts.map(function (post) {
                  return writeData("posts", post);
                }),
              );
            })
            .then(function () {
              console.log(
                "[Service Worker] Publicaciones guardadas:",
                posts.length,
              );
            });
        })
        .catch(function (err) {
          console.log("[Service Worker] No se actualizaron los posts:", err);
        }),
    );

    // Si no hay conexión, feed.js consulta IndexedDB.
    event.respondWith(networkResponse);
  } else if (isInArray(event.request.url, STATIC_FILES)) {
    // ARCHIVOS ESTÁTICOS
    event.respondWith(
      caches.match(event.request).then(function (response) {
        return response || fetchAndCache(event.request);
      }),
    );
  } else {
    // CACHÉ DINÁMICA: imágenes y otros recursos.
    event.respondWith(
      caches
        .match(event.request)
        .then(function (response) {
          if (response) {
            return response;
          }

          return fetchAndCache(event.request);
        })
        .catch(function () {
          var accept = event.request.headers.get("accept") || "";

          if (
            event.request.mode === "navigate" ||
            accept.includes("text/html")
          ) {
            return caches.match("/offline.html").then(function (response) {
              return response || Response.error();
            });
          }

          return Response.error();
        }),
    );
  }
});

self.addEventListener("sync", function (event) {
  console.log("[Service Worker] Background Syncing", event);

  if (event.tag === "sync-new-posts") {
    console.log("[Service Worker] Syncing new Posts");

    event.waitUntil(
      readAllData("sync-posts")
        .then(function (data) {
          return Promise.all(
            data.map(function (dt) {
              return fetch(
                "https://uteq-test-e1406-default-rtdb.firebaseio.com/post.json",
                {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    Accept: "application/json",
                  },
                  body: JSON.stringify({
                    id: dt.id,
                    title: dt.title,
                    location: dt.location,
                    image: dt.image,
                  }),
                },
              ).then(function (res) {
                console.log("Sent data", res);

                if (!res.ok) {
                  throw new Error("Error al enviar: " + res.status);
                }

                return deleteItemFromData("sync-posts", dt.id);
              });
            }),
          );
        })
        .then(function () {
          return self.clients.matchAll().then(function (clients) {
            clients.forEach(function (client) {
              client.postMessage({ type: "posts-synced" });
            });
          });
        })
        .catch(function (err) {
          console.log("Error while sending data", err);
          throw err;
        }),
    );
  }
});
