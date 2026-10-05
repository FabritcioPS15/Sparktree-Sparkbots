#!/bin/bash
# ============================================================
#  deploy.sh — Script de instalación en VPS (Ubuntu 22.04)
#  Uso: bash deploy.sh
# ============================================================

set -e  # Detener si hay error

echo ""
echo "╔═══════════════════════════════════════════╗"
echo "║   Sparktree Sparkbots — Deploy Script     ║"
echo "╚═══════════════════════════════════════════╝"
echo ""

# ─── 1. Actualizar el sistema ────────────────────────────────
echo "📦 [1/7] Actualizando paquetes del sistema..."
apt-get update -qq && apt-get upgrade -y -qq

# ─── 2. Instalar Docker ──────────────────────────────────────
echo "🐳 [2/7] Instalando Docker..."
if ! command -v docker &> /dev/null; then
    curl -fsSL https://get.docker.com | sh
    systemctl enable docker
    systemctl start docker
    echo "✅ Docker instalado"
else
    echo "✅ Docker ya estaba instalado"
fi

# ─── 3. Instalar Git ─────────────────────────────────────────
echo "📂 [3/7] Instalando Git..."
apt-get install -y -qq git

# ─── 4. Clonar el repositorio ────────────────────────────────
echo "📥 [4/7] Clonando repositorio..."
if [ -d "/opt/sparktree" ]; then
    echo "   Repositorio ya existe, haciendo pull..."
    cd /opt/sparktree
    git checkout multiempresa
    git pull origin multiempresa
else
    git clone -b multiempresa https://github.com/FabritcioPS15/Sparktree-Sparkbots.git /opt/sparktree
    cd /opt/sparktree
fi

# ─── 5. Crear archivo .env ───────────────────────────────────
echo ""
echo "⚙️  [5/7] Configurando variables de entorno..."
if [ ! -f "/opt/sparktree/.env" ]; then
    cp /opt/sparktree/.env.production.example /opt/sparktree/.env
    echo ""
    echo "⚠️  IMPORTANTE: Debes editar el archivo .env con tus valores reales:"
    echo "   nano /opt/sparktree/.env"
    echo ""
    echo "   Presiona ENTER cuando hayas editado el .env para continuar..."
    read -r
fi

# ─── 6. Crear carpeta de certificados SSL ────────────────────
echo "🔐 [6/7] Preparando carpeta SSL..."
mkdir -p /opt/sparktree/ssl
echo "   ⚠️  Recuerda copiar tus certificados de Cloudflare a /opt/sparktree/ssl/"
echo "      - cert.pem  (Cloudflare Origin Certificate)"
echo "      - key.pem   (Cloudflare Origin Private Key)"

# ─── 7. Levantar los servicios ───────────────────────────────
echo ""
echo "🚀 [7/7] Construyendo y levantando los servicios..."
cd /opt/sparktree
docker compose -f docker-compose.prod.yml up -d --build

echo ""
echo "╔═══════════════════════════════════════════╗"
echo "║           ✅ Deploy completado!           ║"
echo "╚═══════════════════════════════════════════╝"
echo ""
echo "📊 Estado de los contenedores:"
docker compose -f docker-compose.prod.yml ps
echo ""
echo "📋 Ver logs en tiempo real:"
echo "   docker compose -f docker-compose.prod.yml logs -f"
echo ""
echo "🔗 Health check del backend:"
echo "   curl http://localhost:3000/health"
echo ""
