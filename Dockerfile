FROM oven/bun

WORKDIR /usr/src/app

COPY package*.json bun.lockb ./
RUN bun install
COPY . .

# Build the project
RUN bun build ./src/index.ts --outdir ./public

ENV NODE_ENV production

CMD [ "bun", "start" ]
