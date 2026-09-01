# The tag is pinned to the exact @playwright/test version in package.json.
# These two drifting apart is the classic mystery failure - the client library
# talks a protocol the bundled browsers do not speak, and the errors that come
# back have nothing to do with the real cause. If you bump Playwright, bump this
# line in the same commit.
#
# Multi-arch, so this pulls a native arm64 image on an Apple Silicon Mac rather
# than running amd64 under emulation.
FROM mcr.microsoft.com/playwright:v1.62.1-noble

WORKDIR /app

# Dependencies first, in their own layer. Editing a test then rebuilds in
# seconds instead of reinstalling everything.
COPY package.json package-lock.json ./
RUN npm ci

# The browsers are already in the image at /ms-playwright, put there by the same
# release that produced the tag above, so there is no playwright install step
# here and nothing to download at build time.

COPY . .

# The e2e suite is what most people want. Override it on the command line, or
# use one of the named services in compose.yaml.
CMD ["npm", "run", "test:e2e"]
