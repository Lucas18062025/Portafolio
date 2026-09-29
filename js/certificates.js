const CERTIFICATES_URL = "./data/certificates.json";

function createCertificateCard(certificate) {
    const card = document.createElement("div");
    card.className = "cert-card";
    const isFormacion = certificate.type === "logro";

    const preview = document.createElement("div");
    preview.className = "cert-preview";

    const image = document.createElement("img");
    image.src = certificate.preview;
    image.alt = certificate.alt;
    image.width = 400;
    image.height = 250;
    image.loading = "lazy";
    image.style.objectFit = "cover";
    image.style.objectPosition = "top";
    preview.appendChild(image);

    const body = document.createElement("div");
    body.className = "cert-body";

    const title = document.createElement("h3");
    const titleIcon = document.createElement("i");
    titleIcon.className = certificate.icon;
    titleIcon.setAttribute("aria-hidden", "true");
    title.append(titleIcon, ` ${certificate.title}`);

    const meta = document.createElement("p");
    meta.className = "cert-meta";
    if (certificate.meta) {
        meta.append(certificate.meta, " · ");
    }
    meta.append(
        Object.assign(document.createElement("span"), {
            textContent: certificate.dateLabel
        }),
        " · ",
        certificate.issuer
    );

    const description = document.createElement("p");
    description.textContent = certificate.description;

    const link = document.createElement("a");
    link.href = certificate.document;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.className = "btn btn-b";

    const linkIcon = document.createElement("i");
    linkIcon.className = "fas fa-file-pdf";
    linkIcon.setAttribute("aria-hidden", "true");
    link.append(linkIcon, document.createElement("span"));
    link.lastElementChild.textContent = isFormacion ? "VER LOGRO" : "VER CREDENCIAL";

    body.append(title, meta, description, link);
    card.append(preview, body);

    return card;
}

async function loadCertificates() {
    const gridCert = document.querySelector("#grid-certificaciones");
    const gridLogros = document.querySelector("#grid-logros");
    const legacy = document.querySelector("#certificaciones .grid");

    // Agrupa por tipo: certificaciones profesionales vs logros.
    function renderGrouped(certificates) {
        const fragCert = document.createDocumentFragment();
        const fragLogros = document.createDocumentFragment();

        certificates.forEach((certificate) => {
            const card = createCertificateCard(certificate);
            if (certificate.type === "logro") {
                fragLogros.appendChild(card);
            } else {
                fragCert.appendChild(card);
            }
        });

        gridCert.replaceChildren(fragCert);
        gridCert.dataset.dynamicCertificates = "true";
        gridLogros.replaceChildren(fragLogros);
        gridLogros.dataset.dynamicCertificates = "true";
    }

    if (!gridCert || !gridLogros) {
        if (!legacy) {
            return;
        }
    }

    try {
        const response = await fetch(CERTIFICATES_URL);

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const certificates = await response.json();

        if (!Array.isArray(certificates)) {
            throw new Error(
                "certificates.json no contiene un array válido"
            );
        }

        if (gridCert && gridLogros) {
            // Reemplaza las tarjetas HTML hardcodeadas
            // por las tarjetas generadas desde certificates.json.
            renderGrouped(certificates);
        } else {
            const fragment = document.createDocumentFragment();

            certificates.forEach((certificate) => {
                fragment.appendChild(
                    createCertificateCard(certificate)
                );
            });

            legacy.replaceChildren(fragment);
            legacy.dataset.dynamicCertificates = "true";
        }

    } catch (error) {
        // Si falla la carga dinámica, se conservan las tarjetas
        // hardcodeadas del HTML como respaldo: la sección nunca
        // queda vacía frente al visitante.
        if (gridCert) {
            gridCert.dataset.certificatesError = "true";
        }
        if (gridLogros) {
            gridLogros.dataset.certificatesError = "true";
        }
        if (legacy) {
            legacy.dataset.certificatesError = "true";
        }
        console.error(
            "No se pudieron cargar los certificados dinámicos, se mantiene el contenido estático:",
            error
        );
    }
}

function initCertTabs() {
    const tabs = Array.from(document.querySelectorAll(".cert-tab"));
    const panels = Array.from(document.querySelectorAll(".cert-panel"));
    if (!tabs.length || !panels.length) {
        return;
    }
    function activate(key) {
        tabs.forEach((t) =>
            t.setAttribute(
                "aria-selected",
                t.dataset.cert === key ? "true" : "false"
            )
        );
        panels.forEach((p) => {
            const show = p.id === "panel-" + key;
            if (show) {
                p.removeAttribute("hidden");
            } else {
                p.setAttribute("hidden", "");
            }
        });
    }
    tabs.forEach((t) =>
        t.addEventListener("click", () => activate(t.dataset.cert))
    );
    const tablist = document.querySelector(".cert-tabs");
    if (tablist) {
        tablist.addEventListener("keydown", (e) => {
            const i = tabs.findIndex(
                (t) => t.getAttribute("aria-selected") === "true"
            );
            let n = null;
            if (e.key === "ArrowRight") {
                n = (i + 1) % tabs.length;
            } else if (e.key === "ArrowLeft") {
                n = (i - 1 + tabs.length) % tabs.length;
            } else if (e.key === "Home") {
                n = 0;
            } else if (e.key === "End") {
                n = tabs.length - 1;
            } else {
                return;
            }
            tabs[n].focus();
            activate(tabs[n].dataset.cert);
            e.preventDefault();
        });
    }
}

document.addEventListener("DOMContentLoaded", () => {
    loadCertificates();
    initCertTabs();
});