# A) How to run

## Start postgres

docker compose up -d # launches only the default services
docker compose ps # show container status

docker compose stop # graceful stop
docker compose start # restart stopped containers
docker compose restart # restart all containers
docker compose down # stop + remove containers (data volumes stay)

## One-shot: import / update workflows

### container imports every JSON in ./workflows, prints “✓ All workflows imported.”, then exits

docker compose --profile init up --abort-on-container-exit n8n_workflow_init

## import the credential (service name is "n8n")

docker compose exec n8n \
 n8n import:credentials --input /tmp/credentials.json

## Live logs

docker compose logs -f n8n # tail n8n stdout/stderr
docker compose logs -f postgres # tail Postgres logs

## Rebuild the app image after Dockerfile changes

docker compose build n8n # rebuild only the n8n image
docker compose up -d # recreate n8n_container with the new image

# B) How to export credentials

## 1 ∙ export all credentials from the running n8n container

docker compose exec n8n \
 n8n export:credentials --all --output /tmp/creds.json

## 2 ∙ copy the exported file from the container to your host machine

docker cp "$(docker compose ps -q n8n):/tmp/creds.json" ./creds.json
