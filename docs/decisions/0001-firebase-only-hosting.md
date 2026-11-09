# ADR 0001: Host everything on Firebase and Cloud Run

Date: 2026-11-09

## Context

The original brief suggested Hugging Face Spaces or Render for the API. The
owner prefers a single provider and a single bill, with a budget cap on the
Blaze plan.

## Decision

- Frontend on Firebase Hosting.
- FastAPI container on Cloud Run in the same Google Cloud project, region
  `us-central1`, scale-to-zero, max 2 instances.
- Firebase Hosting rewrites `/api/**` to the Cloud Run service so the browser
  talks to one origin.
- No Firebase Cloud Functions. The API stays a plain container that also runs
  anywhere else with Docker.

## Consequences

- Cloud Run requires the Blaze plan; the free quota covers a portfolio app.
- The deploy workflow needs a service account key stored as a GitHub secret.
- Cold starts of a few seconds are acceptable for a demo; `--min-instances 0`
  keeps cost at zero when idle.
