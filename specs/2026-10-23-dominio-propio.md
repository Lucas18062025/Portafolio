# SPEC — dominio propio (postergado con disparador) — 2026-10-23

> Regla: ningún cambio grande entra a preview sin este spec de 15 líneas.
> Vive en `specs/YYYY-MM-DD-slug.md` (ignorado en deploy) o como Acta Obsidian si es solo decisión.
> Flujo: SPEC → prototipo en preview → demo al usuario → port real → `.\deploy.ps1`.

## Decisión (23/10/2026)

**No se compra dominio hasta tener los primeros clientes.** Motivo: económica, no técnica.
Se sigue sobre `portafolio.lucaslean1806.workers.dev`. Este spec queda **congelado y listo**:
cuando se cumpla el disparador, se ejecuta el checklist sin volver a decidir nada.

**Disparador (cualquiera de los dos):**
1. Primer cliente firmado o primer pago cobrado.
2. Cualquier mes con ≥ 50 impresiones en Search Console (señal de que el contenido ya tracciona
   y el dominio pasa a amplificar en vez de arrancar de cero).

**Métrica de éxito definida ANTES de gastar** (baseline medido 9 sep – 19 oct, sesión 22/10):
0 clics · 8 impresiones · pos 12,75 · **solo la home indexada**.
Criterio a 60 días post-migración: ≥ 1 impresión en al menos 2 de los 5 posts + los 2 posts
dejando "Descubierta: actualmente sin indexar".

## Objetivo

Migrar el sitio de `*.workers.dev` a `<DOMINIO>` sin perder tráfico, sin romper el sensor CSP
ni el SEO, y con rollback de 1 comando. `<DOMINIO>` es el parámetro: el resto está resuelto.

## Estado actual (medido, no supuesto)

- Base live: `https://portafolio.lucaslean1806.workers.dev` (7 páginas en el sitemap).
- **144 ocurrencias de `workers.dev` en 18 archivos versionados** (ver tabla de alcance).
- Cert y HSTS ya los da Cloudflare; TLS 1.3, vence 06/01/2027.
- 0 terceros en runtime → la migración **no toca ningún CDN externo**.
- `.assetsignore` ya excluye todos los `.md` → **una PR de docs no cambia ni un byte desplegado**.

## Alcance (los 18 archivos, con conteo exacto)

| Archivo | Ocurrencias | Qué se cambia |
|---|---|---|
| `index.html` | 20 | `canonical`, `og:url`, `og:image`, JSON-LD `@id`/`url`/`image`/`logo`/`publisher` |
| `blog/visual-field-notes/index.html` | 25 | idem + `VideoObject` (`contentUrl`, `thumbnailUrl`) |
| `blog/index.html` | 13 | idem + `Blog`/`publisher.logo` |
| 4 posts restantes | 14 c/u | idem |
| `sitemap.xml` | 7 | las 7 `<loc>` |
| `robots.txt` | 1 | línea `Sitemap:` |
| `_headers` | 2 | `Reporting-Endpoints` + `Report-To` (**URL absoluta**) |
| `.well-known/security.txt` | 1 | `Canonical:` |
| `data/resume.jsonld` | 2 | `url`, `@id` |
| `assets/cv/PORTFOLIO_ONE_PAGER.pdf` | 2 | **regenerar** (no editar) |
| `docs/media-kit/one-pager.template.html` | 1 | plantilla → regenera el PDF |
| `docs/media-kit/portafolio-one-pager.md` | 1 | fuente del one-pager |
| `scripts/generate_onepager.py` | 1 | URL base hardcodeada |
| `scripts/health-checks.mjs` | 1 | **URL base de T5/T10 — si no se cambia, los checks validan el dominio viejo** |
| `worker.js` | 0 | **+** rama nueva: 301 desde `*.workers.dev` |
| `README.md` | 11 | solo docs (no se despliega) |

## No-objetivos

- No se toca la paleta, ni el copy, ni el robot/parche de parpadeo, ni el layout.
- No se migra a Pages, ni a otro host, ni a otro registrar que no sea Cloudflare/NIC.ar.
- No se activa HSTS `preload` para el dominio nuevo el día 1 (ver Riesgos).
- No se cambia DNS de nada más (no hay MX hoy).

## Opciones de dominio

| Opción | Dónde | A favor | En contra |
|---|---|---|---|
| `.com` | Cloudflare Registrar | Precio de costo, sin markup, WHOIS privacy gratis, NS ya en CF, 1 clic | Es el más caro de los baratos (~10-12 USD/año, verificar el día de compra) |
| `.dev` | Cloudflare Registrar | Barato, fuerza HTTPS (HSTS preload del TLD) | Menos "CV-friendly" para un reclutador no técnico |
| `.com.ar` | **NIC.ar** (CF Registrar NO lo vende) | Barato en ARS, local, buen fit para clientes de Argentina | Requiere delegar NS a Cloudflare a mano; sin WHOIS privacy de CF |
| Subdominio gratis (js.org, eu.org) | — | 0 USD | **Descartado**: autoridad ≈ 0, no sirve para un CV y resta confianza |

**Recomendación:** `<nombre>.com.ar` si los clientes son argentinos; `.com` si el objetivo es
remoto/internacional. Decidir en 5 minutos el día del disparador, no antes.

## Orden de ejecución (el checklist)

1. **Comprar** `<DOMINIO>` (Registrar o NIC.ar) → verificar NS apuntando a Cloudflare.
2. **Agregar Custom Domain al Worker**: Workers → `portafolio` → Settings → Domains & Routes →
   Add → Custom domain. Cloudflare crea el registro DNS y el cert solo.
3. **Search Console ANTES de servir**: agregar propiedad **Dominio** (`<DOMINIO>`) y verificar
   por TXT. Dejar viva la propiedad URL-prefix actual.
4. **Rama** `feat/dominio-propio`, reemplazo de las 144 ocurrencias (los 14 archivos desplegables).
5. **`worker.js`**: si `url.hostname.endsWith('.workers.dev')` → `301` a `<DOMINIO>` + path + query.
   Excepción: `POST /api/csp-report` **sigue aceptando** en el host viejo (ver Riesgos).
6. **`scripts/health-checks.mjs`**: base URL → `<DOMINIO>` (si no, T5/T10 pasan validando el host viejo).
7. **Regenerar** el one-pager (`scripts/generate_onepager.py`) y el CV si tiene URL impresa.
8. **`.\deploy.ps1 -Check`** → PR → merge (el CI despliega).
9. **Verificar**: `curl -I https://portafolio.lucaslean1806.workers.dev/` → `301` a `<DOMINIO>`;
   `curl -I https://<DOMINIO>/` → `200` + HSTS; T5 7/7 + T10 8/8 contra el dominio nuevo.
10. **Search Console** → herramienta **Cambio de dirección** (site move) del prefijo viejo al nuevo.
11. **Reenviar** `sitemap.xml` en la propiedad nueva + prueba en tiempo real de `/` y de 1 post.
12. **Reescribir** los links externos (GitHub profile, LinkedIn, firma de mail, one-pager enviados).

Tiempo estimado: **2-3 h** el día del disparador (el 60% es el paso 4, mecánico).

## Lo que Cloudflare ya te da gratis (palanca sin costo, hoy)

- **Registrar a costo**: sin markup ni upsell; renovación al mismo precio.
- **SSL/TLS + HSTS + Always Use HTTPS**: ya activos. No hay que pagar cert.
- **Custom Domain en el Worker**: DNS + cert automáticos, sin tocar `wrangler.jsonc`.
- **Cache Rules**: los assets ya tienen `?v=N` + `immutable`; el cache hit es gratis.
- **Web Analytics**: sin cookies y sin banner de consentimiento → encaja con la página de
  privacidad y con la Ley 25.326 (no hay dato personal que declarar). **No** usar GA4.
- **Email Routing**: con dominio, `contacto@<DOMINIO>` → Gmail, gratis, con SPF/DKIM que CF agrega.
  Hoy no se puede (necesita dominio propio): es un beneficio que **solo llega con la compra**.
- **Turnstile**: gratis hasta 1M/mes, si algún día hay formulario de contacto (hoy no hay inputs).
- **Access**: gratis hasta 50 usuarios, para proteger un panel privado (útil para Open Code Duet).
- **Workers free tier**: 100k req/día; el sitio está muy por debajo. El plan pago es por el
  `observability`/logs, no por tráfico.

## Riesgos y trampas

| Riesgo | Mitigación |
|---|---|
| **El sensor CSP se apaga en silencio** (pasó el 20/10) | `Reporting-Endpoints` y `Report-To` son **URLs absolutas** en `_headers`: si quedan en el host viejo, los reportes van a un 301 y el navegador los descarta. Cambiarlas **y** mantener el POST aceptado en el host viejo ≥ 6 meses (HTML cacheado sigue reportando ahí) |
| T5/T10 validando el dominio viejo | Cambiar `scripts/health-checks.mjs` en el **mismo** PR (paso 6) |
| Duplicate content (dos hosts sirviendo 200) | 301 desde `workers.dev` en el mismo deploy que agrega el Custom Domain. Sin ventana de 2 hosts |
| Perder el `@graph`/`ImageObject` al editar JSON-LD | T3b + `node scripts/verify-csp.js`; validar `@graph` en prod (check T8) |
| HSTS `preload` irreversible | No precargar el dominio nuevo hasta 30 días de estabilidad. El HSTS normal (sin preload) ya alcanza |
| Link roto en el one-pager ya enviado | Se conserva el 301 **permanente**; los PDF viejos siguen funcionando |
| Cuota de indexación | El site move **no** exige solicitar indexación de 7 URLs; el 301 + sitemap alcanzan |

## Checks

- T1–T5 + T8 (`@graph` en prod) + T10 (`Reporting-Endpoints` con URL **absoluta y del dominio nuevo**).
- T7 (Search Console) manual: propiedad nueva verificada, sitemap `Correcto`, site move hecho.
- T9 no aplica (no cambia CSS/JS) salvo que el reemplazo toque `main.js`.
- Verificación extra nueva (agregar a `health-checks.mjs`): el host viejo responde **301**, no 200.

## Rollback

1. `git revert <sha>` del commit de migración → push a rama → PR → merge → el CI despliega.
2. Quitar el Custom Domain en el dashboard (instantáneo); `workers.dev` vuelve a servir 200.
3. El dominio comprado **no se pierde** (queda sin usar); el gasto es el único costo hundido.
4. La propiedad de Search Console nueva se puede borrar; la URL-prefix vieja nunca se tocó.

## Costo

- Dominio: precio de costo del TLD, 1 año, **verificar en el dashboard el día de la compra**
  (Cloudflare no cobra markup; `.com.ar` se paga en NIC.ar).
- Resto: **0 USD**. No hay cert, ni CDN, ni analytics que pagar.
