# Makefile for Shizu Backend Automation

up:
	@echo "🚀 Starting Shizu backend + DB with Docker..."
	docker compose up --build -d

down:
	@echo "🛑 Stopping containers..."
	docker compose down -v
	docker builder prune -f

logs:
	@echo "📜 Showing logs..."
	docker compose logs -f shizu_backend

test:
	@echo "🧪 Running tests inside Docker..."
	docker compose exec -T shizu_backend pytest --maxfail=1 --disable-warnings -q || echo "⚠️ Tests failed"

rebuild:
	@echo "🔁 Rebuilding containers..."
	docker compose down -v
	docker compose up --build -d

clean:
	@echo "🧹 Cleaning up Docker environment..."
	docker system prune -af

