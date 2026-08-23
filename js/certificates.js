const CERTIFICATES_URL = "./data/certificates.json";

function createCertificateCard(certificate) {
    const card = document.createElement("div");
    card.className = "cert-card";

    card.innerHTML = `
        <div class="cert-preview">
            <img
                src="${certificate.preview}"
                alt="${certificate.alt}"
                style="object-fit:cover; object-position:top;"
                loading="lazy"
            >
        </div>

        <div class="cert-body">
            <h3>
                <i class="${certificate.icon}" aria-hidden="true"></i>
                ${certificate.title}
            </h3>

            <p class="cert-meta">
                ${certificate.meta}
                &nbsp;·&nbsp;
                <span>${certificate.dateLabel}</span>
                &nbsp;·&nbsp;
                ${certificate.issuer}
            </p>

            <p>${certificate.description}</p>

            <a
                href="${certificate.document}"
                target="_blank"
                rel="noopener noreferrer"
                class="btn btn-b"
            >
                <i class="fas fa-file-pdf" aria-hidden="true"></i>
                <span>VER CREDENCIAL</span>
            </a>
        </div>
    `;

    return card;
}

async function loadCertificates() {
    const container = document.querySelector("#certificaciones .grid");

    if (!container) {
        console.error("No se encontró #certificaciones .grid");
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

        console.info(
            `Certificados cargados desde JSON: ${certificates.length}`
        );

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

        console.info(
            "Certificados renderizados correctamente."
        );

    } catch (error) {
        console.error(
            "Error cargando certificados:",
            error
        );
    }
}

document.addEventListener(
    "DOMContentLoaded",
    loadCertificates
);