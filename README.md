# A) How to run

- BUILD with `docker compose --profile crawl4ai build --no-cache`
- UP with `docker compose --profile crawl4ai up -d --force-recreate`
- DOWN with `docker compose --profile crawl4ai down --remove-orphans`
- EXPORT with `docker compose --profile export run --rm n8n_workflow_export`

That should be all. Import should be automatic, but if not, you can import using the n8n_workflow_init service or manually in n8n.
