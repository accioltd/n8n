# syntax=docker/dockerfile:1
FROM node:20-bookworm-slim

################################################################
# 1) Core settings
################################################################
ENV DEBIAN_FRONTEND=noninteractive \
    TZ=UTC \
    PIP_BREAK_SYSTEM_PACKAGES=1 \
    N8N_BLOCK_ENV_ACCESS_IN_NODE=false \
    CODE_NODE_PYTHON_BINARY=/usr/bin/python3

################################################################
# 2) Seldom-changed OS libraries  (own layer → cached)
################################################################
RUN apt-get update -qq && apt-get install -y -qq --no-install-recommends \
      git python3 python3-pip \
      fontconfig libjpeg62-turbo libpng16-16 libfreetype6 \
      libglib2.0-0 libcairo2 libpango-1.0-0 \
      libtiff6 libopenjp2-7 libpotrace0 libxml2 \
      openjdk-17-jre-headless tini tesseract-ocr tesseract-ocr-por tesseract-ocr-eng poppler-utils \
      libreoffice-core libreoffice-impress \
   && apt-get clean && rm -rf /var/lib/apt/lists/*

################################################################
# 3) Seldom-changed Python libs (own layer → cached)
################################################################
RUN apt-get update -qq && \
    apt-get install -y -qq --no-install-recommends \
        pandoc curl && \
    curl -fSL \
      https://repo1.maven.org/maven2/org/apache/tika/tika-app/2.9.0/tika-app-2.9.0.jar \
      -o /usr/local/bin/tika-app.jar


      
################################################################
# 4) n8n itself (rarely changes – separate cached layer)
################################################################
RUN npm install -g n8n@1.98.1
RUN npm install -g mammoth@1.9.0 --force

################################################################
# 5) Copy helper script  ← NEW location
################################################################

# COPY code/split_pdf.py /usr/local/bin/
# RUN chmod +x /usr/local/bin/split_pdf.py

################################################################
# 6) Workdir & ports
################################################################
WORKDIR /data
EXPOSE 5678

################################################################
# 7) Entrypoint
################################################################
ENTRYPOINT ["/usr/bin/tini","--","n8n","start"]
