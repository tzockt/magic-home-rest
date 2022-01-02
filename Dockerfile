FROM node:17-alpine

RUN mkdir -p /app/node_modules && chown -Rf node:node /app

WORKDIR /app

COPY package*.json ./

USER node

RUN npm install

COPY --chown=node:node . .

EXPOSE 3000

CMD [ "node", "index.js" ]