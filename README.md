<!-- ⚠️ NO BORRAR: google*.html en la raíz = verificación de Google Search Console.
     Sin ese archivo se pierde la propiedad verificada. deploy.ps1 aborta si falta. -->
<div align="center">

# 🌐 Portafolio · Lucas Villagra

[![Status](https://img.shields.io/badge/status-live-22c55e?style=for-the-badge&logo=cloudflare&logoColor=white)](https://portafolio.lucaslean1806.workers.dev/)
[![License](https://img.shields.io/badge/license-MIT-7b2fff?style=for-the-badge)](LICENSE)
[![Platform](https://img.shields.io/badge/platform-Cloudflare_Workers-F6821F?style=for-the-badge&logo=cloudflare&logoColor=white)](https://portafolio.lucaslean1806.workers.dev/)
[![Stack](https://img.shields.io/badge/stack-HTML_%7C_CSS_%7C_JS-00c8ff?style=for-the-badge)](https://portafolio.lucaslean1806.workers.dev/)

> *Portafolio profesional de ciberseguridad ·*
> *Red Team · Blue Team · AI Orchestrator · Tucumán, Argentina*

**[→ Ver sitio en vivo](https://portafolio.lucaslean1806.workers.dev/)**

</div>

---

## 🚀 Laboratorio y Proyectos

**📡 Auditoría Wireless · Alfa AWUS036ACS**
Reconocimiento de espectro 2.4/5 GHz en modo monitor. Captura y análisis de handshakes WPA2 con aircrack-ng.
`Kali Linux` `aircrack-ng` `Alfa AWUS036ACS`

**🔒 OpSec · Infraestructura VPN Anónima**
Túneles cifrados WireGuard (UDP) con Proton VPN, verificados con controles locales de fugas DNS/IP. Kill Switch activo.
`WireGuard` `ProtonVPN` `OpSec`

**🔐 Security Audit Checker** — [ver despliegue](https://security-audit-checker.lucaslean1806.workers.dev/)
Auditoría rápida de infraestructura para PyMEs del NOA con captura de leads y aviso instantáneo por Telegram. Backend en Cloudflare Workers con validación server-side y fallback local.
`Cloudflare` `Workers` `Telegram` `JavaScript`

**🛡️ SIEM v4.0 · Threat Intel** — [ver despliegue](https://siem-windows-11.lucaslean1806.workers.dev/)
Monitoreo en vivo cada 10s sobre Security + System: 9 Event IDs críticos con scoring CVSS v3.1 y alertas a Telegram con rate-limit anti-spam.
`Python 3.10+` `Telegram API` `CVSS v3.1` `NIST`

**🛡️ Sentinel V7 Apex** — [ver despliegue](https://sentinel.lucaslean1806.workers.dev/)
Mantenimiento y auditoría Windows en ~11s: firewall en 3 perfiles, Event Viewer y detección de conexiones TCP sospechosas, todo con log de evidencia.
`PowerShell` `Windows Security` `Defensive Security` `V7 Apex`

**🎣 Gophish Lab** — [ver despliegue](https://gophishlab.lucaslean1806.workers.dev/)
Laboratorio controlado de simulación de campañas de phishing: vectores de ingeniería social, métricas y respuesta defensiva. Fines educativos y laboratorio autorizado.
`Gophish` `Social Engineering` `Security Awareness` `Lab`

**🌐 Network Egress Monitor**
Monitor defensivo de conexiones salientes: visibilidad sobre tráfico egress y comportamientos anómalos en endpoints y redes.
`Network Security` `Monitoring` `Egress` `Defensive`

**🔐 Secure Web Platform** — [ver despliegue](https://frontend.lucaslean1806.workers.dev/)
Plataforma web con arquitectura defensiva: Next.js + TypeScript sobre Cloudflare Workers.
`Next.js` `TypeScript` `Cloudflare` `Web Security`

**📊 ZenHub Dashboard** — [ver despliegue](https://zenhub-dashboard.lucaslean1806.workers.dev/)
Dashboard web para visualización y gestión de información de proyectos.
`Project Management` `Data Visualization` `Web Development`

---

## 🔬 Investigación

Artículos propios en [`/blog`](https://portafolio.lucaslean1806.workers.dev/blog/): mentalidad Red Team, aprendizaje continuo y aislamiento en máquinas virtuales.

## 📜 Certificaciones

`Cisco · Hacker Ético` `Google · Cybersecurity (Coursera)` `Google · AI Essentials (Coursera)` `BIG School · Ciberseguridad y Hacking Ético`

---

## 🛠️ Stack Técnico

| Categoría | Tecnología |
|---|---|
| **Frontend** | `HTML5` `CSS3` `JavaScript (Vanilla)` |
| **Tipografía** | `Inter` `Space Grotesk` `JetBrains Mono` |
| **Iconos** | `Font Awesome 6.4` |
| **Deploy** | `Cloudflare Workers` (espejo legacy: `Vercel`) |
| **Efectos** | `Canvas API` `CSS Animations` |
| **SEO** | `Sitemap` `robots.txt` `JSON-LD` `Open Graph` |

---

## 💼 Servicios Profesionales

**🛡️ Auditoría & Hardening**
Endurecimiento de sistemas y análisis de configuraciones. Informe ejecutivo + técnico. `PyMEs · NOA`

**🎯 Pentesting · Red Team**
Simulación controlada de ciberataques con evidencia y remediación. `PyMEs · NOA`

**🎣 Concientización & Phishing Simulation**
Campañas controladas de phishing: métricas de clics, reportes accionables y capacitación. `PyMEs · NOA`

Contacto: [WhatsApp](https://wa.me/543814764474) · [Email](mailto:lucaslean1806@gmail.com) · [LinkedIn](https://www.linkedin.com/in/lucas-villagra-cybersecurity/)

---

## 🧑‍💻 Desarrollo local y deploy

```powershell
# Vista previa local
npx serve .

# Deploy a Cloudflare Workers
.\deploy.ps1   # aborta si falta google*.html (ver nota arriba)
```

Estructura: `index.html` · `css/` · `js/` · `assets/` (projects, certificates, cv, og) · `blog/` · `data/certificates.json` · `wrangler.jsonc` · `_headers` / `vercel.json` (headers y caché).

---

## 📜 Licencia

Distribuido bajo licencia **MIT**. Ver [`LICENSE`](LICENSE) para más detalles.

---

<div align="center">

*© 2026 Lucas Villagra · System Secured · Built on Cloudflare Workers*

`[ uptime: ∞ | threat level: monitored | status: operational ]`

</div>
