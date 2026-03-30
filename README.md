# Fun Mechanics

Static website for the Fun Mechanics archive. The site is served directly from the repository root and includes local DjVu documents, Ruffle assets, and static HTML/CSS/JS.

## Project Files

- `index.html`: page structure
- `styles.css`: layout and visual styles
- `script.js`: client-side behavior
- `Caddyfile`: HTTPS static-site config for `funmechanics.net:8443`
- `aws/route53-policy.json`: least-privilege Route53 policy for ACME DNS challenge
- `aws/ec2-trust-policy.json`: trust policy for an EC2 instance role
- `systemd/caddy.service`: Amazon Linux systemd unit for the custom Caddy binary

## Local Run

Open `index.html` in a browser, or serve the folder with a static file server.

## Caddy Deployment

The repository includes a [Caddyfile](/home/nikiigo/PyCharmMiscProject/Caddyfile) configured for:

- domain: `funmechanics.net`
- HTTPS listener: `8443`
- ACME DNS challenge through AWS Route53
- hosted zone ID: `Z08479271XP3Y2S4Z33KH`

The repository copy is version-controlled here, but the deployed config should live outside the website root at `/etc/caddy/Caddyfile`.

Current config:

```caddyfile
{
	acme_dns route53 {
		hosted_zone_id Z08479271XP3Y2S4Z33KH
	}
}

funmechanics.net:8443 {
	root * /srv/funmechanics
	file_server
}
```

Because this uses the Route53 DNS challenge, certificate issuance does not depend on inbound access to ports `80` or `443`.

Clients still need `funmechanics.net` DNS records to point to the public IP of the instance so they can reach `https://funmechanics.net:8443/`.

## Server Directory Setup

Create the website directory on the server and set ownership to the user that runs the web server. On most Caddy installs that user is `caddy`.

Example:

```bash
sudo mkdir -p /srv/funmechanics
sudo chown -R caddy:caddy /srv/funmechanics
```

Clone the repository into that directory:

```bash
sudo -u caddy git clone git@github.com:nikiigo/funmechanics.git /srv/funmechanics
```

Move the version-controlled Caddy config into place:

```bash
sudo mv /srv/funmechanics/Caddyfile /etc/caddy/Caddyfile
```

The deployed config should use:

```caddyfile
root * /srv/funmechanics
```

This keeps the active Caddy config outside the static file root.

## Required Caddy Build

The standard Caddy binary does not include Route53 support by default. Build Caddy with the Route53 plugin:

```bash
xcaddy build --with github.com/caddy-dns/route53@v1.6.1
```

Run it with:

```bash
./caddy run --config /etc/caddy/Caddyfile
```

## Install Caddy As A Service

On Amazon Linux, build a custom Caddy binary with the Route53 plugin and install it with a systemd unit.

Install build dependencies:

```bash
sudo dnf install -y golang git curl tar
```

Create the `caddy` service account and config directories:

```bash
sudo groupadd --system caddy
sudo useradd --system \
  --gid caddy \
  --create-home \
  --home-dir /var/lib/caddy \
  --shell /sbin/nologin \
  --comment "Caddy web server" \
  caddy
sudo mkdir -p /etc/caddy
sudo chown root:caddy /etc/caddy
sudo chmod 750 /etc/caddy
```

Build and install Caddy with Route53 support:

```bash
go install github.com/caddyserver/xcaddy/cmd/xcaddy@latest
~/go/bin/xcaddy build --with github.com/caddy-dns/route53@v1.6.1
sudo mv ./caddy /usr/local/bin/caddy
sudo chown root:root /usr/local/bin/caddy
sudo chmod 755 /usr/local/bin/caddy
```

Install the active config and the systemd service file:

```bash
sudo mv /srv/funmechanics/Caddyfile /etc/caddy/Caddyfile
sudo cp /srv/funmechanics/systemd/caddy.service /etc/systemd/system/caddy.service
sudo systemctl daemon-reload
sudo systemctl enable --now caddy
sudo systemctl status caddy
```

Validate and reload after config changes:

```bash
sudo /usr/local/bin/caddy validate --config /etc/caddy/Caddyfile
sudo systemctl reload caddy
journalctl -u caddy --no-pager
```

## AWS IAM Setup

This deployment is intended to use the EC2 instance profile credential chain instead of static AWS keys.

Role name:

- `FunMechanicsSiteInstance`

Attach these permissions to that role:

- custom Route53 policy from [aws/route53-policy.json](/home/nikiigo/PyCharmMiscProject/aws/route53-policy.json)
- AWS managed policy `AmazonSSMManagedInstanceCore`

Attach the managed SSM policy with:

```bash
aws iam attach-role-policy \
  --role-name FunMechanicsSiteInstance \
  --policy-arn arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore
```

Create and attach the Route53 policy:

```bash
aws iam create-policy \
  --policy-name FunMechanicsRoute53Access \
  --policy-document file://aws/route53-policy.json
```

```bash
aws iam attach-role-policy \
  --role-name FunMechanicsSiteInstance \
  --policy-arn arn:aws:iam::YOUR_ACCOUNT_ID:policy/FunMechanicsRoute53Access
```

If you need to create the role from scratch, use [aws/ec2-trust-policy.json](/home/nikiigo/PyCharmMiscProject/aws/ec2-trust-policy.json) as the trust policy for EC2.

## EC2 Notes

When using an instance profile:

- do not set `AWS_ACCESS_KEY_ID` or `AWS_SECRET_ACCESS_KEY`
- ensure the role is attached to the running EC2 instance
- allow outbound access to AWS APIs needed by Route53 and Systems Manager

Quick instance-profile verification on the host:

```bash
curl -s http://169.254.169.254/latest/meta-data/iam/security-credentials/
```

If that returns the role name, the instance profile is attached and available to Caddy.
