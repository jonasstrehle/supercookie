#---------- Build Stage ----------
FROM node:22-alpine AS build
WORKDIR /app

#----------- Copy Manifest files ------------
COPY ./package.json ./
COPY ./package-lock.json ./
COPY ./tsconfig.json ./

#------------ Install Dependencies --------------
RUN npm install

#------------ Copy The main Source code ---------
COPY www ./www
COPY src ./src

#------------- Run the TS Transpiler -------------
RUN npm run build

#------------ Prod Stage ---------------
FROM node:22-alpine AS prod
WORKDIR /app

COPY package*.json ./
RUN npm install --only=production --legacy-peer-deps

COPY --from=build /app/www ./www
COPY --from=build /app/dist ./dist

EXPOSE 10080 10081

RUN addgroup -S cookie && adduser -S cookie-guy -G cookie
RUN chown -R cookie-guy:cookie /app
USER cookie-guy

CMD [ "npm","run","start" ]