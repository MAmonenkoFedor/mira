FROM node:20-alpine
WORKDIR /app
COPY package.json tsconfig.json ./ 
COPY src ./src
RUN corepack enable && npm i
ENV PORT=3001
EXPOSE 3001
CMD ["npm","start"]
