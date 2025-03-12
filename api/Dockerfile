# syntax=docker.io/docker/dockerfile:1

# *******
# Note this does not work for steamlink
# Bluetooth and device info works but steamlink cannot launch here, making it mostly useless
# *******

FROM node:18-alpine AS base

RUN apk add --no-cache bluez coreutils udev upower libcec-tools

WORKDIR /app/api/dist

ENV NODE_ENV=production

EXPOSE 3002

ENV PORT=3002

# server.js is created by next build from the standalone output
# https://nextjs.org/docs/pages/api-reference/config/next-config-js/output
ENV HOSTNAME="0.0.0.0"
CMD ["node", "index.js"]
