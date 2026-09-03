const CERTIFICATES_URL = "./data/certificates.json";

function createCertificateCard(certificate) {
    const card = document.createElement("div");
    card.className = "cert-card";

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
    meta.append(
        certificate.meta,
        " · ",
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
    link.lastElementChild.textContent = "VER CREDENCIAL";

    body.append(title, meta, description, link);
    card.append(preview, body);

    return card;
}

async function loadCertificates() {
    const container = document.querySelector("#certificaciones .grid");

    if (!container) {
        return;
    }

    try {
        const response = await fetch(CERTIFICATES_URL, {
            cache: "no-store"
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const certificates = await response.json();

        if (!Array.isArray(certificates)) {
            throw new Error(
                "certificates.json no contiene un array válido"
            );
        }

        const fragment = document.createDocumentFragment();

        certificates.forEach((certificate) => {
            fragment.appendChild(
                createCertificateCard(certificate)
            );
        });

        // Reemplaza las tarjetas HTML hardcodeadas
        // por las tarjetas generadas desde certificates.json.
        container.replaceChildren(fragment);

        container.dataset.dynamicCertificates = "true";

    } catch (error) {
        container.replaceChildren();
        container.dataset.certificatesError = "true";
    }
}

document.addEventListener(
    "DOMContentLoaded",
    loadCertificates
);