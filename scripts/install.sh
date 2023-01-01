curl -fsSL https://fnm.vercel.app/install | bash
source /root/.bashrc
fnm install 19
fnm use 19
export $(grep -v '^#' .env | xargs -d '\n')
