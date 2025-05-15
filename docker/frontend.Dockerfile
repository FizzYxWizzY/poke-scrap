# docker/frontend.Dockerfile

FROM node:18

# Dossier de travail dans le conteneur
WORKDIR /app

# Copier les fichiers du projet React
COPY ./frontend/package*.json ./
RUN npm install

COPY ./frontend .

EXPOSE 5173

# Démarrer le serveur de dev Vite
CMD ["npm", "run", "dev", "--", "--host"]
