import click
import requests
from app import create_app

@click.group()
def cli():
    """Shizu Dev CLI"""
    pass

@cli.command()
def routes():
    """List all Flask routes"""
    app = create_app()
    for rule in app.url_map.iter_rules():
        print(f"{rule.endpoint:20s} -> {rule.rule}")

@cli.command()
def health():
    """Ping the /health endpoint"""
    try:
        res = requests.get("http://localhost:5000/health")
        print(f"✅ {res.status_code} - {res.json()}")
    except Exception as e:
        print(f"❌ Health check failed: {e}")

if __name__ == "__main__":
    cli()

