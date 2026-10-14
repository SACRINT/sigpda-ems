# Dockerfile — Typst Worker Container para Fly Machines
# SIGPDA-EMS · Motor Editorial de Alta Gama (Fase 2)
#
# Características de Producción:
# - Base: Node.js 22 LTS (Debian Bookworm Slim).
# - Binario Typst: Versión fijada v0.13.0 (x86_64 musl estático oficial, Apache-2.0).
# - Fuentes canónicas abiertas (SIL OFL):
#   * Liberation Sans (métricamente compatible con Arial).
#   * Inter (diseño editorial de alta legibilidad).
#   * PROHIBIDO Arial (licencia propietaria).
# - Scale-to-zero: Compatible con suspensión y reanudación rápida en Fly Machines (< 500 ms).
# - Medición de memoria: Lee /proc/[pid]/status (VmHWM) y cgroups v2 (memory.peak).

FROM node:22-bookworm-slim AS runtime

# Variables de entorno
ENV NODE_ENV=production \
    PORT=8080 \
    TYPST_VERSION=0.13.0 \
    FONTS_DIR=/app/fonts \
    TEMPLATES_DIR=/app/templates

WORKDIR /app

# Instalar dependencias del sistema, fuentes abiertas SIL OFL y descargar Typst fijado
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    xz-utils \
    ca-certificates \
    fonts-liberation \
    fonts-inter \
    && rm -rf /var/lib/apt/lists/* \
    && curl -sSL "https://github.com/typst/typst/releases/download/v${TYPST_VERSION}/typst-x86_64-unknown-linux-musl.tar.xz" \
       | tar -xJ --strip-components=1 -C /usr/local/bin typst-x86_64-unknown-linux-musl/typst \
    && chmod +x /usr/local/bin/typst \
    && mkdir -p /app/fonts \
    && cp /usr/share/fonts/truetype/liberation/*.ttf /app/fonts/ \
    && find /usr/share/fonts/ -type f \( -name "*Inter*.otf" -o -name "*Inter*.ttf" \) -exec cp {} /app/fonts/ \;

# Verificar instalación y versiones
RUN typst --version && ls -la /app/fonts/

# Copiar archivos del worker
COPY package.json ./
RUN npm install --omit=dev

COPY . .

# Exponer puerto HTTP
EXPOSE 8080

# Health check interno de Docker
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:8080/health || exit 1

# Comando de inicio
CMD ["node", "server.js"]
