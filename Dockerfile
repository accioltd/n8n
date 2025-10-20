# syntax=docker/dockerfile:1
FROM node:20-bookworm-slim

################################################################
# 1) Core settings
################################################################
ENV DEBIAN_FRONTEND=noninteractive \
    TZ=UTC \
    PIP_BREAK_SYSTEM_PACKAGES=1 \
    N8N_BLOCK_ENV_ACCESS_IN_NODE=false \
    CODE_NODE_PYTHON_BINARY=/usr/bin/python3 \
    N8N_CUSTOM_EXTENSIONS=/home/node/.n8n/custom

################################################################
# 2) OS libraries (+ build tools needed for sqlite native modules)
################################################################
RUN apt-get update -qq && apt-get install -y -qq --no-install-recommends \
      git python3 python3-pip \
      build-essential g++ make libsqlite3-0 libsqlite3-dev \
      fontconfig libjpeg62-turbo libpng16-16 libfreetype6 \
      libglib2.0-0 libcairo2 libpango-1.0-0 \
      libtiff6 libopenjp2-7 libpotrace0 libxml2 \
      openjdk-17-jre-headless tini tesseract-ocr tesseract-ocr-por tesseract-ocr-eng poppler-utils \
      libreoffice-core libreoffice-writer libreoffice-impress \
   && python3 -m pip install --no-cache-dir --upgrade pip \
   && pip install --no-cache-dir \
        docling \
        pypdfium2 \
        pillow \
        openai \
        python-dotenv \
        requests \
   && ln -sf /usr/bin/python3 /usr/local/bin/python \
   && apt-get clean && rm -rf /var/lib/apt/lists/*

################################################################
# 3) n8n + global tools + sqlite native bindings (built from source)
################################################################
# Note: build from source is required so the native .node bindings exist at runtime.
ENV npm_config_build_from_source=1 \
    npm_config_python=/usr/bin/python3
RUN npm i -g \
      n8n@1.114.3 \
      mammoth@1.9.1 \
      typescript@5.9.2 \
      @azure/identity@4.11.1 \
      @azure/openai@2.0.0 \
      sqlite3@5.1.7 \
      better-sqlite3@12.2.0 \
    --unsafe-perm --build-from-source

################################################################
# 4) Runtime
################################################################
WORKDIR /data
EXPOSE 5678
ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["n8n", "start"]
