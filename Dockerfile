FROM node:20-alpine

WORKDIR /app

COPY eur-lex-api/package*.json ./eur-lex-api/
RUN cd eur-lex-api && npm install --production

COPY eur-lex-api ./eur-lex-api

WORKDIR /app/eur-lex-api

EXPOSE 3000

CMD ["npm", "start"]
