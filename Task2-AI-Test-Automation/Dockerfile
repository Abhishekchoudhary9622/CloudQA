FROM node:22-bookworm
WORKDIR /app

# Copy dependency manifests
COPY Task2-AI-Test-Automation/package*.json ./

# Install Node.js dependencies
RUN npm ci

# Install Chromium and its system dependencies
RUN npx playwright install --with-deps chromium

# Copy Task 2 application
COPY Task2-AI-Test-Automation/ ./

# Build TypeScript
RUN npm run build

ENV NODE_ENV=production
ENV HEADLESS=true
ENV PORT=10000

EXPOSE 10000

# Start the Express application
CMD ["npm", "run", "server"]

