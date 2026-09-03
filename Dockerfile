FROM node:20-bookworm-slim

# Install C++ compiler, build tools, curl and Unicode fonts for PDF rendering
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    g++ \
    curl \
    fonts-dejavu-core \
    fonts-liberation \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy dependency manifests
COPY package*.json ./

# Install Node.js dependencies
RUN npm install --omit=dev

# Copy application source code
COPY . .

# Ensure bin directory exists
RUN mkdir -p bin temp sample_docs

# Compile native C++17 PDF Engine on Linux
RUN g++ -std=c++17 -O3 -pthread \
    src/native/main.cpp \
    src/native/miniz.c \
    src/native/miniz_tdef.c \
    src/native/miniz_tinfl.c \
    -o bin/pdf_engine \
    && chmod +x bin/pdf_engine

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3000

# Expose application port
EXPOSE 3000

# Start production server
CMD ["node", "src/server/app.js"]
