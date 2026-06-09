# Usa uma versão leve do Node.js (que o React precisa para rodar)
FROM node:20-alpine

# Define a pasta de trabalho dentro do nosso "computador virtual" do Docker
WORKDIR /app

# Instala o gerenciador de pacotes pnpm que o seu projeto usa
RUN npm install -g pnpm

# Copia os arquivos que dizem quais dependências o projeto precisa
COPY package.json pnpm-workspace.yaml* pnpm-lock.yaml* ./

# Instala todas as dependências do projeto
RUN pnpm install

# Copia o restante dos arquivos do seu projeto para dentro do Docker
COPY . .

# Expõe a porta 5173, que é a porta padrão do Vite
EXPOSE 5173

# Inicia o servidor do seu site e libera o acesso para a sua máquina (--host)
CMD ["pnpm", "run", "dev", "--", "--host"]