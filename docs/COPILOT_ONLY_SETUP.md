# NanoClaw: setup and daily workflow with GitHub Copilot (without Claude Code)

This guide is for running NanoClaw **only with GitHub Copilot-based auth/workflows**.

> Important: the runtime is still NanoClaw + its containerized agent process. “Copilot-only” here means you do not need to drive setup with Claude Code slash commands.

## 1) Install dependencies

```bash
npm install
```

## 2) Check your environment

```bash
npm run setup -- --step environment
```

This reports:
- platform (`macos` / `linux`)
- available container runtime (`docker` or Apple `container`)
- whether previous auth/config already exists

## 3) Authenticate GitHub token for Copilot-linked usage

If you do not already have one of these env vars in `.env`:
- `GH_TOKEN`
- `GITHUB_TOKEN`
- `GITHUB_COPILOT_TOKEN`

run:

```bash
npm run setup -- --step copilot-auth
```

The script starts GitHub Device Flow, gives you a code, and writes the token to `.env` after confirmation.

## 4) Build/validate the container image

Choose one runtime:

```bash
# Docker (macOS/Linux)
npm run setup -- --step container -- --runtime docker

# Apple Container (macOS)
npm run setup -- --step container -- --runtime apple-container
```

## 5) Authenticate WhatsApp

```bash
npm run setup -- --step whatsapp-auth
```

Follow the QR/login instructions shown by the setup script.

## 6) Register your main channel/group

Use your own values:

```bash
npm run setup -- --step register -- \
  --jid "<your-jid>" \
  --name "Main" \
  --trigger "@Jan" \
  --folder "main"
```

Optional flags:
- `--assistant-name "YourAssistantName"`
- `--no-trigger-required`

## 7) (Optional) Configure mounts

```bash
npm run setup -- --step mounts
```

Use this if you want the agent container to access selected local directories.

## 8) Install as a service

```bash
npm run setup -- --step service
```

This configures:
- `launchd` on macOS
- `systemd --user` (or fallback) on Linux

## 9) Verify installation

```bash
npm run setup -- --step verify
```

## 10) Day-to-day operation (Copilot workflow)

Use Copilot Chat in your editor/terminal to modify this repo, but run NanoClaw operational commands directly from shell:

```bash
npm run build
npm run start
```

For local development:

```bash
npm run dev
```

---

## Troubleshooting quick notes

- **Auth prompt says setup is required** → rerun `npm run setup -- --step whatsapp-auth`.
- **Container errors** → rerun container step with explicit `--runtime`.
- **No responses in WhatsApp** → run verify step and inspect `logs/setup.log`.
