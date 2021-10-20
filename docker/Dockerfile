FROM node:8.10.0-alpine

# Copy source code
ARG GIT_TOKEN
ARG commitid
ARG branch

RUN apk update \
    && apk add --no-cache git nginx automake autoconf python \
    file nasm libpng-dev binutils-gold curl g++ gcc gnupg libgcc libtool make wget sudo \
    && set -x \
    && adduser -u 82 -D -S -G www-data www-data \
    && mkdir /btccom-src/ \
    && cd /btccom-src/ \
    && git clone https://${GIT_TOKEN}@github.com/blocktrail/blocktrail-webwallet.git \
    && cd /btccom-src/blocktrail-webwallet \
    && git fetch \
    && git checkout ${branch} \
    && git pull \
    && cd docker \
    && cp nginx.conf /etc/nginx/nginx.conf \
    && cp nginx.site.conf /etc/nginx/conf.d/default.conf \
    && cd /btccom-src/blocktrail-webwallet \
    && cp appconfig.default.json appconfig.json \
    && git submodule update --init --recursive \
    && npm install -g gulp@3.9.1 \
    && npm install gulp@3.9.1 \
    && npm install \
    && gulp

WORKDIR /btccom-src/blocktrail-webwallet
EXPOSE 80
CMD ["nginx"]