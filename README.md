# CrewBarn Work Dashboard

The day-to-day CrewBarn app — jobs, customers, scheduling, dispatch, estimates,
invoicing, inventory and the work tools in the Tool Shed — built to run on
**your own domain**.

It is a static site. Your data, your logins and every provider key stay on
CrewBarn; this talks to the CrewBarn API at `api.crewbarn.com` and holds
nothing itself.

## What is and is not here

Here: 142 routes covering the work. 123 pages.

Not here, and genuinely absent rather than hidden — seats and billing, API
tokens, provider keys and integrations, encryption, security settings,
self-hosted domains, the customer app, and CrewBarn's own platform admin
console. Those live on [connect.crewbarn.com](https://connect.crewbarn.com).

That is worth being precise about. This repository is generated from
CrewBarn's source by an allowlist, and the generator refuses to run if any of
those screens is still reachable from the published entry point — so they are
not in this source to be re-enabled by editing a flag.

The server is what actually enforces it, not this build. When you sign in
through a self-hosted CrewBarn, the session the API issues is marked as
console-issued and those routes are refused for it, whatever the page sends.
Removing a page from a copy gains nothing and adding one back gains nothing
either.

## Run it

```bash
npm install
cp .env.example .env     # VITE_API_URL=https://api.crewbarn.com
npm run dev
```

Ready-to-host zip: the [latest release](https://github.com/crewbard/crewbard-crewbarn-work/releases/latest).
Unzip onto any static host. CrewBarn's Quick setup does exactly this into your
own Cloudflare Pages — see Self-hosted CrewBarn on connect.crewbarn.com.

You need a CrewBarn account to sign in; this is the client, not the service.

## Generated

Do not send pull requests against this repository — it is regenerated from
CrewBarn's source on each release and anything committed here is overwritten.
See GENERATED.md for what this build was cut from.

## License

MIT. See LICENSE.
